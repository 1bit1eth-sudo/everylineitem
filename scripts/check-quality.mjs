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
const hits = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [], E7: [] };
const DESC = {
  E1: "Every fee item has an http(s) source_url",
  E2: "Every fee item has a last_verified (checked) date",
  E3: "Every jurisdiction has an official fee_schedule_url and last_verified date",
  E4: "No unrendered template tokens ({{ }} {% ${) in reader text",
  E5: "No internal notes (TODO/FIXME/[확인 필요]/Korean internal memo text) in reader text",
  E6: "Every page has a non-empty <title>",
  E7: "Every page has a non-empty meta description",
};

const fees = JSON.parse(await readFile("src/data/fees.json", "utf8"));
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
for (const [id, list] of Object.entries(hits)) {
  const level = WARN_RULES.has(id) ? "WARN" : "ERROR";
  console.log(`  [${list.length ? level : "ok"}] ${id} ${DESC[id]} -> ${list.length}`);
  for (const h of list.slice(0, 5)) console.log(`      - ${h}`);
  if (list.length > 5) console.log(`      ... +${list.length - 5} more`);
  if (level === "ERROR") errors += list.length;
}
if (errors) { console.error(`check-quality: FAILED (${errors} error-level violations)`); process.exit(1); }
console.log("check-quality: ok");
