import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile("scrape-config.json", "utf8"));
const OUTPUT = "external-live.js";
const USER_AGENT = String(config.userAgent || "NEXOVONARSA-Corporate-Scraper/4.0 (+GitHub Actions)").trim();

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

const ROBOTS_CACHE = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response, baseDelay, attempt) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(baseDelay * (2 ** attempt), seconds * 1000);
  const date = Date.parse(retryAfter || "");
  if (Number.isFinite(date)) return Math.max(baseDelay * (2 ** attempt), date - Date.now());
  return baseDelay * (2 ** attempt);
}

function robotsAllows(text, targetUrl, userAgent) {
  const groups = [];
  let current = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    if (!line || !line.includes(":")) continue;
    const separator = line.indexOf(":");
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      current = { agents: [value.toLowerCase()], allow: [], disallow: [] };
      groups.push(current);
      continue;
    }
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    if (key === "disallow" && value) current.disallow.push(value);
  }
  const matching = groups.filter((group) => group.agents.includes("*") || group.agents.some((agent) => userAgent.toLowerCase().includes(agent)));
  if (!matching.length) return true;
  const allow = matching.flatMap((group) => group.allow).filter(Boolean);
  const disallow = matching.flatMap((group) => group.disallow).filter(Boolean);
  const path = targetUrl.pathname || "/";
  const longest = (list) => list.filter((rule) => path.startsWith(rule)).sort((a, b) => b.length - a.length)[0] || "";
  const blocked = longest(disallow);
  const permitted = longest(allow);
  return !blocked || permitted.length >= blocked.length;
}

async function robotsCheck(url, userAgent) {
  const origin = new URL(url).origin;
  if (ROBOTS_CACHE.has(origin)) return ROBOTS_CACHE.get(origin);
  const robotsUrl = origin + "/robots.txt";
  let result = { allowed: true, checked: true, url: robotsUrl, status: null };
  try {
    const response = await fetchText(robotsUrl, 8000, 300000);
    result.status = response.status;
    result.allowed = robotsAllows(response.html, new URL(url), userAgent);
  } catch (error) {
    result.error = error && error.message ? error.message : String(error);
  }
  ROBOTS_CACHE.set(origin, result);
  return result;
}

async function fetchText(url, timeoutMs, maxBytes) {
  const retries = Number(config.maxRetries) >= 0 ? Number(config.maxRetries) : 2;
  const baseDelay = Number(config.baseBackoffMs) >= 0 ? Number(config.baseBackoffMs) : 700;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
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
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (contentType && !/(text\/html|application\/xhtml\+xml|text\/plain)/.test(contentType)) throw new Error("unsupported content type: " + contentType.split(";")[0]);
        const html = await response.text();
        if (Buffer.byteLength(html, "utf8") > maxBytes) throw new Error("response exceeds " + maxBytes + " bytes");
        return { html, status: response.status, finalUrl: response.url, contentType, attempts: attempt + 1 };
      }
      if (!retryable || attempt === retries) throw new Error("HTTP " + response.status + " " + response.statusText);
      await wait(retryDelay(response, baseDelay, attempt));
    } catch (error) {
      if (attempt === retries) throw error;
      await wait(baseDelay * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("request exhausted");
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
    const robots = config.respectRobots === false ? { allowed: true, checked: false } : await robotsCheck(target.href, USER_AGENT);
    if (!robots.allowed) {
      return {
        id: source.id,
        name: source.name,
        requestedUrl: target.href,
        ok: false,
        blockedByRobots: true,
        robotsUrl: robots.url,
        robotsStatus: robots.status,
        error: "Blocked by robots.txt",
        durationMs: Date.now() - started,
        fetchedAt: new Date().toISOString()
      };
    }
    const result = await fetchText(
      target.href,
      Number(config.timeoutMs) || 12000,
      Number(config.maxBytes) || 1500000
    );
    const finalUrl = new URL(result.finalUrl);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== target.hostname) {
      throw new Error("redirected outside the original HTTPS host");
    }
    return {
      id: source.id,
      name: source.name,
      requestedUrl: target.href,
      finalUrl: result.finalUrl,
      canonical: readMeta(result.html, "og:url") || readCanonical(result.html) || result.finalUrl,
      title: readMeta(result.html, "og:title") || readTitle(result.html),
      description: readMeta(result.html, "og:description") || readMeta(result.html, "description"),
      status: result.status,
      contentType: result.contentType || null,
      attempts: result.attempts || 1,
      robotsChecked: robots.checked,
      robotsStatus: robots.status || null,
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
  version: 3,
  generatedAt: new Date().toISOString(),
  sourceCount: results.length,
  successfulCount: results.filter(function (x) { return x.ok; }).length,
  failedCount: results.filter(function (x) { return !x.ok; }).length,
  blockedCount: results.filter(function (x) { return x.blockedByRobots; }).length,
  sources: results
};

await fs.writeFile(OUTPUT, "window.SCRAPE_LIVE_DATA=" + JSON.stringify(snapshot) + ";\n", "utf8");
console.log("Scraped " + snapshot.sourceCount + " public sources: " + snapshot.successfulCount + " OK, " + snapshot.failedCount + " failed.");
