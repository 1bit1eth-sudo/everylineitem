#!/usr/bin/env node
// Post-deploy live check. Not part of `npm run build`.
// Fetches the live sitemap, then checks every listed URL (HTTP 200, robots vs
// sitemap, canonical, title/description length) plus ads.txt and unique
// internal links found on those pages.
//
// Usage:
//   node scripts/verify-live.mjs
//   node scripts/verify-live.mjs --origin https://everylineitem.com
//   node scripts/verify-live.mjs --concurrency 8 --timeout 20000
import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_ORIGIN = process.env.VERIFY_ORIGIN || "https://example.com";
const ADS_TXT_NEEDLE = "google.com, pub-9855716660139171, DIRECT, f08c47fec0942fa0";
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ORIGIN = (arg("--origin", DEFAULT_ORIGIN)).replace(/\/+$/, "");
const CONCURRENCY = Number(arg("--concurrency", "8"));
const TIMEOUT_MS = Number(arg("--timeout", "20000"));

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function normalizePath(url) {
  const u = new URL(url);
  let p = u.pathname || "/";
  if (p !== "/" && !p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p.split("/").pop())) p += "/";
  return p + u.search;
}

function sameOrigin(url) {
  return originOf(url) === ORIGIN;
}

function isSkippableInternal(url) {
  const u = new URL(url);
  if (u.hash && u.pathname + u.search === "") return true;
  const path = u.pathname;
  // Skip generated pin/OG images and obvious static assets for the
  // page-level sitemap/canonical/robots checks; still check they 200
  // when they appear as internal links, so do not skip here.
  return false;
}

async function fetchUrl(url, { retries = 1 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        signal: ctrl.signal,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const ctype = res.headers.get("content-type") || "";
      const text = ctype.includes("image/") || ctype.includes("octet-stream") ? "" : buf.toString("utf8");
      clearTimeout(t);
      return { url: res.url, status: res.status, ok: res.ok, headers: res.headers, text, ctype };
    } catch (err) {
      lastErr = err;
      clearTimeout(t);
      if (i < retries) await sleep(500 * (i + 1));
    }
  }
  return { url, status: 0, ok: false, headers: new Headers(), text: "", ctype: "", error: String(lastErr) };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function locTags(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

async function loadSitemap(origin) {
  const candidates = [`${origin}/sitemap-index.xml`, `${origin}/sitemap.xml`, `${origin}/sitemap-0.xml`];
  let urls = [];
  let used = null;
  for (const start of candidates) {
    const res = await fetchUrl(start);
    if (!res.ok) continue;
    used = start;
    const locs = locTags(res.text);
    const nested = locs.filter((u) => /sitemap/i.test(u) && /\.xml(\?|$)/i.test(u));
    const pages = locs.filter((u) => !nested.includes(u));
    urls.push(...pages);
    for (const child of nested) {
      const c = await fetchUrl(child);
      if (!c.ok) {
        fail(`sitemap child ${child} → HTTP ${c.status}${c.error ? " " + c.error : ""}`);
        continue;
      }
      urls.push(...locTags(c.text));
    }
    break;
  }
  if (!used) fail(`could not fetch a sitemap from ${candidates.join(", ")}`);
  // unique, same-origin only
  const seen = new Set();
  const unique = [];
  for (const u of urls) {
    if (!sameOrigin(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }
  return { used, urls: unique };
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function meta(html, name) {
  const re = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decode((html.match(re) || html.match(re2) || [, ""])[1] || "");
}

function titleOf(html) {
  return decode((html.match(/<title>([^<]*)<\/title>/i) || [, ""])[1] || "").trim();
}

function canonicalOf(html) {
  const m =
    html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return m ? m[1].trim() : "";
}

function robotsOf(html) {
  return meta(html, "robots").toLowerCase();
}

function internalHrefs(html, pageUrl) {
  const out = [];
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    const raw = decode(m[1]);
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
    const abs = resolveUrl(raw, pageUrl);
    if (!abs || !sameOrigin(abs)) continue;
    const u = new URL(abs);
    u.hash = "";
    out.push(u.href);
  }
  return out;
}

function canonicalMatches(canonical, pageUrl) {
  if (!canonical) return false;
  try {
    const a = new URL(canonical, ORIGIN);
    const b = new URL(pageUrl);
    const norm = (u) => {
      let p = u.pathname || "/";
      if (p !== "/" && !p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p.split("/").pop() || "")) p += "/";
      return `${u.origin}${p}`;
    };
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

console.log(`verify-live ${ORIGIN}  (concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms)`);
const started = Date.now();

const ads = await fetchUrl(`${ORIGIN}/ads.txt`);
if (!ads.ok) fail(`ads.txt → HTTP ${ads.status}${ads.error ? " " + ads.error : ""}`);
else if (!ads.text.includes(ADS_TXT_NEEDLE)) fail(`ads.txt is missing the expected line: ${ADS_TXT_NEEDLE}`);

const sitemap = await loadSitemap(ORIGIN);
console.log(`sitemap: ${sitemap.used || "(none)"}  (${sitemap.urls.length} URLs)`);

const sitemapSet = new Set(sitemap.urls.map((u) => normalizePath(u)));
const pageResults = await pool(sitemap.urls, CONCURRENCY, async (url) => {
  const res = await fetchUrl(url);
  return { url, res };
});

const discovered = new Map(); // href -> from
const indexable = [];
let httpOk = 0;
for (const { url, res } of pageResults) {
  if (!res.ok) {
    fail(`${url} → HTTP ${res.status || "error"}${res.error ? " " + res.error : ""}`);
    continue;
  }
  httpOk++;
  const html = res.text;
  const robots = robotsOf(html);
  if (/\bnoindex\b/.test(robots)) fail(`${url}: listed in the sitemap but has robots noindex`);
  else indexable.push(url);
  const title = titleOf(html);
  if (title.length > TITLE_MAX) fail(`${url}: <title> is ${title.length} chars (max ${TITLE_MAX})`);
  const desc = meta(html, "description");
  if (desc.length > DESCRIPTION_MAX) fail(`${url}: meta description is ${desc.length} chars (max ${DESCRIPTION_MAX})`);
  const canon = canonicalOf(html);
  if (!canon) fail(`${url}: missing canonical`);
  else if (!canonicalMatches(canon, res.url || url)) fail(`${url}: canonical "${canon}" does not match the page URL`);
  for (const href of internalHrefs(html, res.url || url)) {
    if (!discovered.has(href)) discovered.set(href, url);
  }
}

// Internal links: every unique same-origin href/src found on sitemap pages.
const already = new Set(sitemap.urls.map((u) => new URL(u).href));
const extra = [...discovered.keys()].filter((u) => !already.has(u) && !already.has(u.replace(/\/$/, "") + (u.endsWith("/") ? "" : "")));
// also compare normalized
const alreadyNorm = new Set([...already].map((u) => {
  try { return ORIGIN + normalizePath(u); } catch { return u; }
}));
const extraUnique = [];
const seenExtra = new Set();
for (const href of discovered.keys()) {
  let key;
  try { key = ORIGIN + normalizePath(href); } catch { key = href; }
  if (alreadyNorm.has(key) || seenExtra.has(key)) continue;
  seenExtra.add(key);
  extraUnique.push(href);
}

console.log(`internal links discovered: ${discovered.size} unique, ${extraUnique.length} not already in the sitemap set`);
const extraResults = await pool(extraUnique, CONCURRENCY, async (url) => {
  const res = await fetchUrl(url);
  return { url, res };
});

let extraOk = 0;
let extraBroken = 0;
for (const { url, res } of extraResults) {
  const from = discovered.get(url) || "(unknown)";
  if (!res.ok) {
    extraBroken++;
    fail(`broken internal link ${url} (from ${from}) → HTTP ${res.status || "error"}${res.error ? " " + res.error : ""}`);
    continue;
  }
  extraOk++;
  const ctype = res.ctype;
  if (!/html/i.test(ctype) && !/html/i.test(res.text.slice(0, 200))) continue;
  const robots = robotsOf(res.text);
  const path = normalizePath(res.url || url);
  const inSitemap = sitemapSet.has(path);
  if (/\bnoindex\b/.test(robots)) {
    if (inSitemap) fail(`${url}: listed in the sitemap but has robots noindex`);
    // noindex and not in sitemap is expected
  } else if (!inSitemap) {
    // indexable HTML page not in the sitemap (404 pages and some utility URLs are ignored)
    const u = new URL(res.url || url);
    const p = u.pathname;
    if (p === "/404" || p === "/404/" || p === "/404.html") continue;
    if (/\.(xml|txt|json|png|jpe?g|webp|svg|ico|css|js|map)$/i.test(p)) continue;
    // Query-string variants of a path that is already in the sitemap (e.g. /compare/?j=…)
    // are not standalone indexable URLs.
    const pathOnly = normalizePath(`${ORIGIN}${p}`);
    if (u.search && (sitemapSet.has(pathOnly) || sitemapSet.has(p) || sitemapSet.has(p.endsWith("/") ? p : p + "/"))) continue;
    warn(`${url}: indexable page is not in the sitemap (linked from ${from})`);
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log("");
console.log("verify-live summary");
console.log(`  origin: ${ORIGIN}`);
console.log(`  sitemap URLs: ${sitemap.urls.length}`);
console.log(`  sitemap HTTP 200: ${httpOk}`);
console.log(`  internal extra links checked: ${extraUnique.length} (200: ${extraOk}, broken: ${extraBroken})`);
console.log(`  ads.txt: ${errors.some((e) => e.startsWith("ads.txt")) ? "FAIL" : "ok"}`);
console.log(`  failures: ${errors.length}`);
console.log(`  warnings: ${warnings.length}`);
console.log(`  elapsed: ${elapsed}s`);
for (const w of warnings) console.log(`WARN ${w}`);
for (const e of errors) console.log(`FAIL ${e}`);
if (errors.length) {
  console.error(`verify-live: ${errors.length} failure(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`verify-live: ok${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
