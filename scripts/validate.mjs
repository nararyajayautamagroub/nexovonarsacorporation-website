import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const required = [
  "index.html","styles.css","data.js","portfolio.js","app.js","github-live.js",
  "external-live.js","sync-config.json","scrape-config.json",
  "scripts/sync-github.mjs","scripts/scrape-public.mjs","config.js","config.example.js",
  "i18n.js","auth.js","experience.js","sw.js","pwa-manifest.webmanifest"
];
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
async function read(path) { return fs.readFile(path, "utf8"); }
function nodeCheck(path) {
  const r = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (r.status !== 0) fail("Syntax error in " + path + ": " + (r.stderr || r.stdout || "").trim());
}
function boot(path, source, window) {
  try {
    vm.runInNewContext(source, { window: window || {} }, { filename: path, timeout: 2500 });
  } catch (error) {
    fail("Bootstrap failed for " + path + ": " + error.message);
  }
}
function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail("Duplicate " + label + ": " + value);
    seen.add(value);
  }
}
function githubUrl(value, label) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.hostname !== "github.com") fail(label + " must be an HTTPS github.com URL: " + value);
  } catch {
    fail(label + " is invalid: " + value);
  }
}

for (const path of required) {
  try { await fs.access(path); } catch { fail("Missing required file: " + path); }
}

for (const path of ["data.js","portfolio.js","app.js","github-live.js","external-live.js","config.js","i18n.js","auth.js","experience.js","scripts/sync-github.mjs","scripts/scrape-public.mjs"]) {
  nodeCheck(path);
}

const html = await read("index.html");
const css = await read("styles.css");
const dataSource = await read("data.js");
const portfolioSource = await read("portfolio.js");
const appSource = await read("app.js");
const liveSource = await read("github-live.js");
const scrapeLiveSource = await read("external-live.js");
const configSource = await read("config.js");
const i18nSource = await read("i18n.js");
const authSource = await read("auth.js");
const experienceSource = await read("experience.js");

for (const src of ["data.js","portfolio.js","github-live.js","external-live.js","config.js","i18n.js","auth.js","experience.js","app.js"]) {
  if (!html.includes('src="' + src + '"')) fail("index.html does not load " + src);
}
for (const id of ["nav","page","modal","toast","menu","sidebar","crumb"]) {
  if (!html.includes('id="' + id + '"')) fail("Missing DOM id: " + id);
}

const dataWindow = {};
boot("data.js", dataSource, dataWindow);
try {
  vm.runInNewContext(portfolioSource, { window: dataWindow }, { filename: "portfolio.js", timeout: 2500 });
} catch (error) {
  fail("Portfolio bootstrap failed: " + error.message);
}
const data = dataWindow.CORPORATE_DATA;
if (!data || !Array.isArray(data.projects)) {
  fail("CORPORATE_DATA.projects is missing");
} else {
  unique((data.companies || []).map(function (x) { return x.id; }), "company id");
  unique(data.projects.map(function (x) { return x.id; }), "project id");
  if (!data.projects.length) fail("Project registry is empty");
  data.projects.forEach(function (p) {
    ["id","company","unit","name","category","platform","status","priority","pic","start","target","budget"].forEach(function (field) {
      if (p[field] == null || String(p[field]).trim() === "") fail("Project " + p.id + " missing " + field);
    });
    if (p.progress != null) {
      const n = Number(p.progress);
      if (!Number.isFinite(n) || n < 0 || n > 100) fail("Invalid progress for " + p.id + ": " + p.progress);
    }
  });
}

const liveWindow = {};
boot("github-live.js", liveSource, liveWindow);
const repoData = liveWindow.GITHUB_LIVE_DATA;
if (!repoData || !Array.isArray(repoData.records)) {
  fail("GITHUB_LIVE_DATA.records is missing");
} else {
  unique(repoData.records.map(function (x) { return x.fullName || x.name; }), "repository");
  repoData.records.forEach(function (r) {
    if (!r.name || !r.fullName) fail("Repository record is missing name/fullName");
    if (r.url) githubUrl(r.url, "Repository URL for " + r.name);
    if (r.company === "UNMAPPED") warn("Unmapped repository: " + r.name);
  });
}

const scrapeWindow = {};
boot("external-live.js", scrapeLiveSource, scrapeWindow);
const scrapeData = scrapeWindow.SCRAPE_LIVE_DATA;
if (!scrapeData || !Array.isArray(scrapeData.sources)) fail("SCRAPE_LIVE_DATA.sources is missing");

const scrapeConfig = JSON.parse(await read("scrape-config.json"));
unique((scrapeConfig.sources || []).map(function (x) { return x.id; }), "scraper source id");
for (const source of scrapeConfig.sources || []) {
  if (!source.id || !source.name || !source.url) fail("Incomplete scraper source");
  try {
    const u = new URL(source.url);
    if (u.protocol !== "https:") fail("Scraper source is not HTTPS: " + source.url);
  } catch {
    fail("Invalid scraper URL: " + source.url);
  }
}

const syncConfig = JSON.parse(await read("sync-config.json"));
unique((syncConfig.repositories || []).map(function (x) { return x.name; }), "sync repository mapping");
const routeMatch = appSource.match(/var N=\[([^\]]+)\]/);
const pagesMatch = appSource.match(/var pages=\{([^}]+)\};/);
if (!routeMatch || !pagesMatch) {
  fail("Unable to inspect application route registry");
} else {
  const routes = Array.from(routeMatch[1].matchAll(/'([^']+)'/g)).map(function (m) { return m[1]; });
  const pages = Array.from(pagesMatch[1].matchAll(/([A-Za-z0-9_]+):\1\b/g)).map(function (m) { return m[1]; });
  routes.forEach(function (route) {
    if (pages.indexOf(route) === -1) fail("Route without renderer: " + route);
  });
}

let depth = 0;
for (const ch of css) {
  if (ch === "{") depth++;
  if (ch === "}") depth--;
}
if (depth !== 0) fail("styles.css has unbalanced braces");

const secretPatterns = ["ghp_","github_pat_","Bearer github_","Authorization: Bearer","service_role"];
const publicSource = html + dataSource + portfolioSource + appSource + liveSource;
secretPatterns.forEach(function (token) {
  if (publicSource.includes(token)) fail("Potential secret/token literal found: " + token);
});

if (!/prefers-reduced-motion/.test(css)) warn("Reduced motion support is missing");
if (scrapeData && scrapeData.failedCount > 0) warn("Generated scraper snapshot contains " + scrapeData.failedCount + " failed source(s)");
if (!/signInWithPassword/.test(authSource) || !/signUp/.test(authSource) || !/signInWithOAuth/.test(authSource) || !/provider:"google"/.test(authSource)) {
  fail("Authentication module is missing one or more required auth flows");
}
if (!/supportedLanguages/.test(configSource) || !Array.isArray((JSON.parse(configSource.match(/window\.NX_CONFIG=([\s\S]*?);\n?/)[1])).app.supportedLanguages) ) {
  warn("Supported language configuration could not be inspected");
}

if (repoData && repoData.unmappedCount > 0) warn("Generated GitHub snapshot contains " + repoData.unmappedCount + " unmapped repo(s)");

console.log("NEXOVONARSA validation");
console.log("Errors: " + errors.length);
console.log("Warnings: " + warnings.length);
warnings.forEach(function (x) { console.log("WARN: " + x); });
if (errors.length) {
  errors.forEach(function (x) { console.error("ERROR: " + x); });
  process.exit(1);
}
