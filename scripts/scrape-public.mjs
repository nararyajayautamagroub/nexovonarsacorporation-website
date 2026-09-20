import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile("scrape-config.json", "utf8"));
const OUTPUT = "external-live.js";
const USER_AGENT = "NEXOVONARSA-Corporate-Scraper/2.0 (+GitHub Actions)";

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;|&#47;/gi, "/")
    .trim();
}

function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function readMeta(html, key) {
  const safeKey = String(key);
  const patterns = [
    new RegExp("<meta[^>]+(?:name|property)=[\"']" + safeKey + "[\"'][^>]+content=[\"']([^\"']*)[\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+(?:name|property)=[\"']" + safeKey + "[\"'][^>]*>", "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return cleanText(match[1]);
  }
  return null;
}

function readTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match && match[1]);
}

function readCanonical(html) {
  const match = String(html || "").match(/<link[^>]+rel=[\"']canonical[\"'][^>]+href=[\"']([^\"']+)[\"'][^>]*>/i);
  return match ? match[1] : null;
}

async function fetchText(url, timeoutMs, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > maxBytes) throw new Error("response exceeds " + maxBytes + " bytes");
    return { html, status: response.status, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeSource(source) {
  const started = Date.now();
  let target;
  try {
    target = new URL(source.url);
  } catch {
    return { id: source.id, name: source.name, requestedUrl: source.url, ok: false, error: "Invalid URL", durationMs: Date.now() - started, fetchedAt: new Date().toISOString() };
  }
  if (target.protocol !== "https:") {
    return { id: source.id, name: source.name, requestedUrl: target.href, ok: false, error: "Only HTTPS sources are allowed", durationMs: Date.now() - started, fetchedAt: new Date().toISOString() };
  }
  try {
    const result = await fetchText(
      target.href,
      Number(config.timeoutMs) || 12000,
      Number(config.maxBytes) || 1500000
    );
    return {
      id: source.id,
      name: source.name,
      requestedUrl: target.href,
      finalUrl: result.finalUrl,
      canonical: readMeta(result.html, "og:url") || readCanonical(result.html) || result.finalUrl,
      title: readMeta(result.html, "og:title") || readTitle(result.html),
      description: readMeta(result.html, "og:description") || readMeta(result.html, "description"),
      status: result.status,
      ok: true,
      durationMs: Date.now() - started,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      requestedUrl: target.href,
      ok: false,
      error: error && error.message ? error.message : String(error),
      durationMs: Date.now() - started,
      fetchedAt: new Date().toISOString()
    };
  }
}

if (!Array.isArray(config.sources) || config.sources.length === 0) {
  throw new Error("scrape-config.json must contain at least one source");
}

const results = [];
for (const source of config.sources) results.push(await scrapeSource(source));

const snapshot = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sourceCount: results.length,
  successfulCount: results.filter(function (x) { return x.ok; }).length,
  failedCount: results.filter(function (x) { return !x.ok; }).length,
  sources: results
};

await fs.writeFile(OUTPUT, "window.SCRAPE_LIVE_DATA=" + JSON.stringify(snapshot) + ";\n", "utf8");
console.log("Scraped " + snapshot.sourceCount + " public sources: " + snapshot.successfulCount + " OK, " + snapshot.failedCount + " failed.");
