#!/usr/bin/env node
/* eslint-disable no-console */
// Build quality gate (runs after `astro build`; a non-zero exit fails the build).
// Rules come from the relay decision log (2026-10-26 08:07 / 11:17: fees aligned to
// official sources with a checked date) and the common site rules (no internal notes,
// no unrendered tokens, every page has a title and meta description).
// WARN rules were already violated on main when the gate was added; they print counts
// but do not fail. Promote a rule to ERROR once its count is 0.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const WARN_RULES = new Set(["E1", "E2", "E3"]);
const hits = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [], E7: [], E8: [] };
const DESC = {
  E1: "Every fee item has an http(s) source_url",
  E2: "Every fee item has a last_verified (checked) date",
  E3: "Every jurisdiction has an official fee_schedule_url and last_verified date",
  E4: "No unrendered template tokens ({{ }} {% ${) in reader text",
  E5: "No internal notes (TODO/FIXME/[확인 필요]/Korean internal memo text) in reader text",
  E6: "Every page has a non-empty <title>",
  E7: "Every page has a non-empty meta description",
  E8: "Home, fee-index, changes, and the public CSV agree with fees.json (numeric consistency)",
};

const fees = JSON.parse(await readFile("src/data/fees.json", "utf8"));
const changelog = JSON.parse(await readFile("src/data/fee-changelog.json", "utf8"));
for (const f of fees.fee_items) {
  if (!/^https?:\/\//.test(f.source_url ?? "")) hits.E1.push(`${f.item_id}: source_url=${f.source_url}`);
  if (!String(f.last_verified ?? "").trim()) hits.E2.push(`${f.item_id}`);
}
for (const j of fees.jurisdictions) {
  if (!/^https?:\/\//.test(j.fee_schedule_url ?? "") || !String(j.last_verified ?? "").trim())
    hits.E3.push(`${j.juris_id}`);
}

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== "pagefind") out.push(...(await walk(full))); }
    else if (ent.name.endsWith(".html")) out.push(full);
  }
  return out;
}
const visible = (h) => h.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

const files = await walk(DIST);
for (const file of files) {
  const rel = path.relative(DIST, file);
  const html = await readFile(file, "utf8");
  if (/http-equiv="?refresh/i.test(html) || /^google[0-9a-f]+\.html$/.test(path.basename(file))) continue;
  const text = visible(html);
  const tok = text.match(/\{\{|\}\}|\{%|\$\{[A-Za-z_]/);
  if (tok) hits.E4.push(`${rel}: "${tok[0]}"`);
  const note = text.match(/\bTODO\b|\bFIXME\b|\[확인 필요\]/) || text.match(/[\uac00-\ud7a3][\uac00-\ud7a3\s]{5,}/); // Korean = internal memo on this English site
  if (note) hits.E5.push(`${rel}: "${note[0]}"`);
  if (path.basename(file) === "404.html" || rel.startsWith("embed/")) continue; // embeds are iframe widgets (noindex)
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!t || !visible(t[1]).trim()) hits.E6.push(rel);
  const d = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!d || !d[1].trim()) hits.E7.push(rel);
}

let errors = 0;
console.log(`check-quality: ${fees.fee_items.length} fee items, ${fees.jurisdictions.length} jurisdictions, ${files.length} HTML files`);

// E8: numeric consistency. Every public number must be computed from
// fees.json at build time — a hardcoded or stale figure fails the build.
//   - home hero line: "<displayed> jurisdictions, <verified> verified line items"
//   - fee-index intro: "<verified> verified line items across <displayed> jurisdictions"
//     and coverage stat "<displayed> × <verified>"
//   - public CSV (latest): data rows == verified items; distinct
//     jurisdictions == jurisdictions with >= 1 verified row; the dated
//     and legacy q3 files must exist with identical content.
//   - change log: no entry may present the site-wide total as one
//     jurisdiction's count ("<jurisdiction> now has <siteTotal> rows
//     (<siteVerified> verified)").
{
  const verifiedItems = fees.fee_items.filter(i => i.status === "verified");
  const verifiedCount = verifiedItems.length;
  const siteTotal = fees.fee_items.length;
  const displayedJuris = fees.jurisdictions.filter(j => j.juris_id !== "LA-BASE").length;
  const jurisWithVerified = new Set(verifiedItems.map(i => i.juris_id)).size;

  const parseCsvLine = (line) => {
    const out = [];
    let cur = "", quoted = false;
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (quoted) {
        if (c === '"') {
          if (line[k + 1] === '"') { cur += '"'; k++; }
          else quoted = false;
        } else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const csvDir = path.join(DIST, "downloads");
  let latestText = null;
  try { latestText = await readFile(path.join(csvDir, "adu-fee-index-latest.csv"), "utf8"); }
  catch { hits.E8.push("dist/downloads/adu-fee-index-latest.csv: missing (CSV generation failed?)"); }
  if (latestText != null) {
    const body = latestText.split(/\r?\n/).filter(l => l.trim() !== "" && !l.startsWith("#"));
    const rows = body.slice(1);
    if (rows.length !== verifiedCount)
      hits.E8.push(`CSV latest: ${rows.length} data rows != ${verifiedCount} verified items`);
    const csvJuris = new Set(rows.map(r => parseCsvLine(r)[0]));
    if (csvJuris.size !== jurisWithVerified)
      hits.E8.push(`CSV latest: ${csvJuris.size} jurisdictions != ${jurisWithVerified} with verified rows`);
    if (!body[0].startsWith("jurisdiction,county,fee_name,category,rate,amount_800_sqft,status,source_url,last_verified,effective_date"))
      hits.E8.push("CSV latest: header columns do not match the required 10 columns");
    // Dated + legacy files must exist and carry identical content.
    const dated = latestText.match(/# Reference date: (\d{4}-\d{2}-\d{2})/)?.[1];
    if (!dated) hits.E8.push("CSV latest: no # Reference date comment line");
    else {
      for (const name of [`adu-fee-index-${dated}.csv`, "adu-fee-index-2026-q3.csv"]) {
        try {
          const other = await readFile(path.join(csvDir, name), "utf8");
          if (other !== latestText) hits.E8.push(`CSV ${name}: content differs from latest`);
        } catch { hits.E8.push(`CSV ${name}: missing`); }
      }
    }
  }

  const mustContain = async (rel, needle, label) => {
    try {
      const html = await readFile(path.join(DIST, rel), "utf8");
      if (!html.includes(needle)) hits.E8.push(`${label}: missing "${needle}"`);
    } catch { hits.E8.push(`${label}: ${rel} unreadable`); }
  };
  await mustContain("index.html", `${displayedJuris} jurisdictions, ${verifiedCount} verified line items`, "home hero");
  await mustContain("fee-index/index.html", `${verifiedCount} verified line items across ${displayedJuris} jurisdictions`, "fee-index intro");
  await mustContain("fee-index/index.html", `${displayedJuris} × ${verifiedCount}`, "fee-index coverage");

  for (const e of changelog.entries ?? []) {
    const m = /now has (\d+) rows \((\d+) verified\)/.exec(e.detail ?? "");
    if (m && Number(m[1]) === siteTotal && Number(m[2]) === verifiedCount)
      hits.E8.push(`changelog ${e.date}: site-wide total written as a jurisdiction count ("${m[0]}")`);
  }
}

for (const [id, list] of Object.entries(hits)) {
  const level = WARN_RULES.has(id) ? "WARN" : "ERROR";
  console.log(`  [${list.length ? level : "ok"}] ${id} ${DESC[id]} -> ${list.length}`);
  for (const h of list.slice(0, 5)) console.log(`      - ${h}`);
  if (list.length > 5) console.log(`      ... +${list.length - 5} more`);
  if (level === "ERROR") errors += list.length;
}
if (errors) { console.error(`check-quality: FAILED (${errors} error-level violations)`); process.exit(1); }
console.log("check-quality: ok");
