#!/usr/bin/env node
// Fee-data audit — no external dependencies.
// Uses only Node.js built-ins (node:fs, node:path, node:url,
// node:child_process), so it runs immediately on any Node install,
// including Windows, with no `npm install`.
//
// What it checks (fees.json + the fee-index CSVs, the source of truth for
// municipality fees):
//   (a) Every fee record has an official source URL (http/https, not the
//       site itself) and a checked date (last_verified).
//   (b) Numeric integrity: money fields must be finite numbers >= 0.
//       Non-numeric or negative values FAIL. Extreme values WARN
//       (per-sq-ft rate above $50/sq ft, flat/base amount above $100,000).
//       $0 is NOT flagged: it is a legitimate value here (exemptions,
//       shared connections, jurisdictions that levy no such fee — 121
//       verified rows carry rate_low 0 for exactly those reasons).
//   (c) Change vs the previous git commit (default baseline HEAD~1,
//       overridable with --baseline <ref>): any single item whose rate
//       moves more than +/-30% is WARNed, as is a $0 -> non-zero change.
//       Added/removed items are listed as info, not warnings.
//
// Exit code: 1 when any FAIL exists, otherwise 0. Warnings never fail.
// Report: docs/fee-audit-report.md (created by this script).
//
// Usage:
//   node scripts/audit-fees.mjs [--baseline <git-ref>]
//
// Notes on how this maps to the real repo:
//   - The checked date is `last_verified`. It is stored in two formats —
//     ISO ("2026-10-16") and human ("7 Oct 2026") — and both are accepted,
//     because the site's own utils (src/utils/formatVerified.ts) treat
//     both as valid. The CSVs store ISO dates only.
//   - "Official government source" cannot be proven from the URL string
//     alone (school districts use .org, water districts .com/.org). The
//     audit checks the URL is an external http(s) link; that it points
//     to an official document is established by the human verification
//     process that sets status "verified", not by this script.
//   - `threshold` is a descriptive string or a number, so it is not
//     numeric-checked. Only rate_low / rate_high / base are.
//   - A non-blank amount_800_sqft in the fee-index CSV may be a single
//     number or a "low-high" range; a blank means the row has no
//     computable amount at 800 sq ft.
//   - This script overlaps with scripts/audit-everylineitem.mjs on the
//     source/date and CSV-integrity checks (that script is the broad gate:
//     disclaimers, banned phrases, 6-step model). This one is the
//     fee-data audit, and it adds the git-diff spike detection that the
//     broad gate does not have.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.join(ROOT, "docs", "fee-audit-report.md");
const SPIKE_THRESHOLD = 0.3;
const EXTREME_PER_SQFT = 50;
const EXTREME_FLAT = 100000;

// ---------------------------------------------------------------- dates
const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

// Parse "2026-10-16" or "7 Oct 2026" into { y, m, d }. Null when unparseable.
export function parseDate(value) {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y, m, d };
  }
  const human = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(value.trim());
  if (human && MONTHS[human[2]]) {
    return { y: Number(human[3]), m: MONTHS[human[2]], d: Number(human[1]) };
  }
  return null;
}

// Today's date in Asia/Seoul (the team's timezone), as { y, m, d }.
export function kstToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

export function dateKey({ y, m, d }) {
  return y * 10000 + m * 100 + d;
}

// ---------------------------------------------------------------- numbers
// Fractional change from old to new. Null when old is 0 or not a number.
export function pctChange(oldValue, newValue) {
  if (typeof oldValue !== "number" || typeof newValue !== "number") return null;
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) return null;
  if (oldValue === 0) return null;
  return (newValue - oldValue) / oldValue;
}

// Compare two fee-item lists (old baseline vs current) by item_id.
// Returns { changed, warned, added, removed }.
//   changed: every item whose rate_low / rate_high / base moved, with pct.
//   warned: the subset with |pct| > threshold, plus $0 -> non-zero moves.
//   added / removed: item_ids present in only one list.
export function compareFeeItems(oldItems, newItems, threshold = SPIKE_THRESHOLD) {
  const oldById = new Map(oldItems.map((r) => [r.item_id, r]));
  const newById = new Map(newItems.map((r) => [r.item_id, r]));
  const changed = [];
  const warned = [];
  const added = [];
  const removed = [];
  for (const [id, next] of newById) {
    const prev = oldById.get(id);
    if (!prev) {
      added.push(id);
      continue;
    }
    for (const field of ["rate_low", "rate_high", "base"]) {
      const o = prev[field];
      const n = next[field];
      if (typeof o !== "number" || typeof n !== "number") continue;
      if (!Number.isFinite(o) || !Number.isFinite(n)) continue;
      if (o === n) continue;
      if (o === 0 && n !== 0) {
        const entry = { item_id: id, juris_id: next.juris_id, field, old: o, new: n, pct: null, zeroToNonZero: true };
        changed.push(entry);
        warned.push(entry);
        continue;
      }
      const pct = pctChange(o, n);
      if (pct === null) continue;
      const entry = { item_id: id, juris_id: next.juris_id, field, old: o, new: n, pct, zeroToNonZero: false };
      changed.push(entry);
      if (Math.abs(pct) > threshold) warned.push(entry);
    }
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) removed.push(id);
  }
  return { changed, warned, added, removed };
}

// ---------------------------------------------------------------- csv
// Minimal CSV parser: quoted fields, commas and newlines inside quotes,
// CRLF or LF line endings. Throws on a structurally broken file.
export function parseCsv(text, fileLabel) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error(`${fileLabel}: unterminated quoted field`);
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  const nonComment = rows.filter((r) => !(r[0] && r[0].startsWith("#")));
  if (nonComment.length === 0) return { header: [], rows: [] };
  return { header: nonComment[0], rows: nonComment.slice(1) };
}

export function isFiniteNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// ---------------------------------------------------------------- main
function main() {
  const fails = [];
  const warns = [];
  const passes = [];
  const infos = [];
  const fail = (section, message) => fails.push({ section, message });
  const warn = (section, message) => warns.push({ section, message });
  const pass = (section, message) => passes.push({ section, message });
  const info = (section, message) => infos.push({ section, message });

  const args = process.argv.slice(2);
  let baselineRef = "HEAD~1";
  const baselineIdx = args.indexOf("--baseline");
  if (baselineIdx !== -1 && args[baselineIdx + 1]) baselineRef = args[baselineIdx + 1];

  const readText = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
  const readJson = (rel) => JSON.parse(readText(rel));

  // ---------------------------------------------------------- (a)+(b) fees.json
  const SECTION_F = "fees.json";
  let fees = null;
  try {
    fees = readJson("src/data/fees.json");
    pass(SECTION_F, "src/data/fees.json parses as JSON");
  } catch (err) {
    fail(SECTION_F, `src/data/fees.json does not parse: ${err.message}`);
  }

  const MONEY_FIELDS = ["rate_low", "rate_high", "base"];
  const KNOWN_STATUSES = new Set(["verified", "to_verify", "illustrative", "conflict"]);
  const FEE_ITEM_COUNT = fees && Array.isArray(fees.fee_items) ? fees.fee_items.length : 0;
  const missingByJuris = new Map();
  const noteMissing = (item, what) => {
    const list = missingByJuris.get(item.juris_id) || [];
    list.push(`${item.item_id}: ${what}`);
    missingByJuris.set(item.juris_id, list);
  };

  if (fees) {
    if (!Array.isArray(fees.fee_items)) {
      fail(SECTION_F, "src/data/fees.json has no fee_items array");
    } else {
      const todayKey = dateKey(kstToday());
      for (const item of fees.fee_items) {
        const id = item.item_id || "(no item_id)";
        if (!item.item_id || !item.juris_id || !item.category || !item.fee_name || !item.method || !item.status) {
          fail(SECTION_F, `${id}: missing a required key (item_id/juris_id/category/fee_name/method/status)`);
        }
        if (item.status && !KNOWN_STATUSES.has(item.status)) {
          fail(SECTION_F, `${id}: unknown status "${item.status}"`);
        }
        // (b) numeric integrity. $0 is legitimate; only non-numeric,
        // negative, or extreme values are flagged.
        for (const key of MONEY_FIELDS) {
          const v = item[key];
          if (v !== null && v !== undefined && v !== "") {
            if (typeof v !== "number" || !Number.isFinite(v)) {
              fail(SECTION_F, `${id}: ${key} is not a number (${JSON.stringify(v)})`);
            } else if (v < 0) {
              fail(SECTION_F, `${id}: ${key} is negative (${v})`);
            } else if (item.method === "per_sqft" && v > EXTREME_PER_SQFT) {
              warn(SECTION_F, `${id} (${item.juris_id}): per-sq-ft ${key} is unusually high ($${v}/sq ft) — check for a typo`);
            } else if (item.method !== "per_sqft" && v > EXTREME_FLAT) {
              warn(SECTION_F, `${id} (${item.juris_id}): ${key} is unusually high ($${v.toLocaleString("en-US")}) — check for a typo`);
            }
          }
        }
        // (a) source URL + checked date.
        const status = item.status;
        const source = typeof item.source_url === "string" ? item.source_url.trim() : "";
        const checked = typeof item.last_verified === "string" ? item.last_verified.trim() : "";
        if (status === "verified" || status === "illustrative" || status === "conflict") {
          if (!/^https?:\/\//.test(source)) {
            fail(SECTION_F, `${id} (${item.juris_id}, ${status}): missing official source URL`);
            noteMissing(item, "missing source_url");
          } else if (/^https?:\/\/([^/]*\.)?everylineitem\.com\//i.test(source) && status === "verified") {
            warn(SECTION_F, `${id} (${item.juris_id}): verified row cites the site itself as its source (circular citation)`);
          }
          const parsed = parseDate(checked);
          if (!parsed) {
            fail(SECTION_F, `${id} (${item.juris_id}, ${status}): missing or unparseable checked date (last_verified=${JSON.stringify(item.last_verified)})`);
            noteMissing(item, "missing/unparseable last_verified");
          } else if (dateKey(parsed) > todayKey) {
            fail(SECTION_F, `${id} (${item.juris_id}, ${status}): checked date is in the future (${checked})`);
          }
        } else if (status === "to_verify") {
          if (!source) warn(SECTION_F, `${id} (${item.juris_id}, to_verify): no source_url recorded yet`);
          if (!checked) warn(SECTION_F, `${id} (${item.juris_id}, to_verify): no last_verified recorded yet`);
        }
      }
      pass(SECTION_F, `${fees.fee_items.length} fee items checked (source + checked date on verified rows, numeric integrity)`);
    }

    if (Array.isArray(fees.jurisdictions)) {
      for (const j of fees.jurisdictions) {
        const jid = j.juris_id || "(no juris_id)";
        if (!/^https?:\/\//.test(typeof j.fee_schedule_url === "string" ? j.fee_schedule_url.trim() : "")) {
          fail(SECTION_F, `jurisdiction ${jid}: missing official fee_schedule_url`);
          noteMissing({ juris_id: jid, item_id: "(jurisdiction)" }, "missing fee_schedule_url");
        }
        if (!parseDate(typeof j.last_verified === "string" ? j.last_verified : "")) {
          fail(SECTION_F, `jurisdiction ${jid}: missing or unparseable last_verified`);
          noteMissing({ juris_id: jid, item_id: "(jurisdiction)" }, "missing/unparseable last_verified");
        }
      }
      pass(SECTION_F, `${fees.jurisdictions.length} jurisdictions checked (fee_schedule_url + last_verified)`);
    } else {
      fail(SECTION_F, "src/data/fees.json has no jurisdictions array");
    }
  }

  // ---------------------------------------------------------- fee-index CSVs
  const SECTION_C = "fee-index CSVs";
  const FEE_INDEX_COLUMNS = [
    "jurisdiction", "county", "fee_name", "category", "rate",
    "amount_800_sqft", "status", "source_url", "last_verified", "effective_date",
  ];
  let latestFeeIndexRows = null;
  try {
    const files = readdirSync(path.join(ROOT, "public", "downloads"))
      .filter((f) => /^adu-fee-index-.*\.csv$/.test(f))
      .sort();
    if (files.length === 0) {
      fail(SECTION_C, "no adu-fee-index-*.csv found in public/downloads/");
    }
    for (const file of files) {
      const rel = `public/downloads/${file}`;
      let parsed;
      try {
        parsed = parseCsv(readText(rel), rel);
      } catch (err) {
        fail(SECTION_C, `${rel}: ${err.message}`);
        continue;
      }
      if (parsed.header.join(",") !== FEE_INDEX_COLUMNS.join(",")) {
        fail(SECTION_C, `${rel}: unexpected header (${parsed.header.join(",")})`);
        continue;
      }
      let rowFails = 0;
      parsed.rows.forEach((row, i) => {
        const lineNo = i + 1;
        if (row.length !== FEE_INDEX_COLUMNS.length) {
          fail(SECTION_C, `${rel} row ${lineNo}: broken row — ${row.length} columns, expected ${FEE_INDEX_COLUMNS.length}`);
          rowFails++;
          return;
        }
        const rec = Object.fromEntries(FEE_INDEX_COLUMNS.map((c, idx) => [c, row[idx]]));
        if (!rec.source_url.trim() || !/^https?:\/\//.test(rec.source_url.trim())) {
          fail(SECTION_C, `${rel} row ${lineNo} (${rec.jurisdiction} — ${rec.fee_name}): empty or non-http source_url`);
          rowFails++;
        }
        if (!rec.last_verified.trim() || !parseDate(rec.last_verified.trim())) {
          fail(SECTION_C, `${rel} row ${lineNo} (${rec.jurisdiction} — ${rec.fee_name}): empty or unparseable last_verified`);
          rowFails++;
        }
        if (rec.status !== "verified") {
          fail(SECTION_C, `${rel} row ${lineNo} (${rec.jurisdiction} — ${rec.fee_name}): status is "${rec.status}", fee-index CSVs are verified-only`);
          rowFails++;
        }
        const amt = rec.amount_800_sqft.trim();
        if (amt !== "") {
          const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(amt);
          const ok = range
            ? Number(range[1]) <= Number(range[2])
            : isFiniteNonNegativeNumber(amt);
          if (!ok) {
            fail(SECTION_C, `${rel} row ${lineNo} (${rec.jurisdiction} — ${rec.fee_name}): amount_800_sqft is not a number or a low-high range (${JSON.stringify(rec.amount_800_sqft)})`);
            rowFails++;
          }
        }
      });
      if (rowFails === 0) pass(SECTION_C, `${rel}: ${parsed.rows.length} rows, all with source + checked date`);
      if (file === "adu-fee-index-latest.csv") latestFeeIndexRows = parsed.rows.length;
    }
  } catch (err) {
    fail(SECTION_C, `could not list public/downloads: ${err.message}`);
  }
  if (latestFeeIndexRows !== null && fees && Array.isArray(fees.fee_items)) {
    const verifiedCount = fees.fee_items.filter((r) => r.status === "verified").length;
    if (latestFeeIndexRows !== verifiedCount) {
      warn(SECTION_C, `adu-fee-index-latest.csv has ${latestFeeIndexRows} rows but fees.json has ${verifiedCount} verified items (regenerate the CSV at build time)`);
    } else {
      pass(SECTION_C, `adu-fee-index-latest.csv row count (${latestFeeIndexRows}) matches fees.json verified count`);
    }
  }

  // ---------------------------------------------------------- (c) git diff vs baseline
  const SECTION_D = "git diff";
  let diffResult = null;
  if (fees && Array.isArray(fees.fee_items)) {
    try {
      const baselineText = execFileSync("git", ["show", `${baselineRef}:src/data/fees.json`], {
        cwd: ROOT, encoding: "utf8", timeout: 30000,
        maxBuffer: 64 * 1024 * 1024, // fees.json is ~1 MB; the default 1 MB buffer overflows (ENOBUFS)
      });
      const baseline = JSON.parse(baselineText);
      if (!Array.isArray(baseline.fee_items)) {
        warn(SECTION_D, `baseline ${baselineRef} has no fee_items array — diff check skipped`);
      } else {
        diffResult = compareFeeItems(baseline.fee_items, fees.fee_items);
        for (const entry of diffResult.warned) {
          const pctText = entry.zeroToNonZero
            ? "was $0, now $" + entry.new
            : `${(entry.pct * 100).toFixed(1)}% ($${entry.old} -> $${entry.new})`;
          warn(SECTION_D, `${entry.item_id} (${entry.juris_id}) ${entry.field} moved ${pctText} vs ${baselineRef} — over the +/-30% spike threshold`);
        }
        if (diffResult.changed.length === 0) {
          pass(SECTION_D, `no fee amounts changed vs ${baselineRef}`);
        } else {
          pass(SECTION_D, `${diffResult.changed.length} fee amount(s) changed vs ${baselineRef} (${diffResult.warned.length} over the +/-30% threshold)`);
        }
        if (diffResult.added.length > 0) info(SECTION_D, `${diffResult.added.length} item(s) added vs ${baselineRef}: ${diffResult.added.join(", ")}`);
        if (diffResult.removed.length > 0) info(SECTION_D, `${diffResult.removed.length} item(s) removed vs ${baselineRef}: ${diffResult.removed.join(", ")}`);
      }
    } catch (err) {
      warn(SECTION_D, `could not read baseline ${baselineRef} from git (${err.message.split("\n")[0]}) — diff check skipped`);
    }
  }

  // ---------------------------------------------------------- report
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
  const lines = [];
  lines.push("# Fee audit");
  lines.push("");
  lines.push(`- Date: ${dateStr} (KST)`);
  lines.push(`- Script: scripts/audit-fees.mjs (Node built-ins only, no packages)`);
  lines.push(`- Baseline for the change check: ${baselineRef}`);
  lines.push(`- Result: ${fails.length === 0 ? "PASS" : "FAIL"} — ${fails.length} FAIL, ${warns.length} WARN, ${passes.length} PASS`);
  lines.push(`- Data checked: fees.json ${FEE_ITEM_COUNT} fee items`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Check | FAIL | WARN | PASS |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const section of [...new Set([...fails, ...warns, ...passes].map((f) => f.section))].sort()) {
    lines.push(`| ${section} | ${fails.filter((f) => f.section === section).length} | ${warns.filter((f) => f.section === section).length} | ${passes.filter((f) => f.section === section).length} |`);
  }
  lines.push("");
  if (fails.length > 0) {
    lines.push("## FAIL");
    lines.push("");
    for (const f of fails) lines.push(`- [${f.section}] ${f.message}`);
    lines.push("");
  }
  if (warns.length > 0) {
    lines.push("## WARN");
    lines.push("");
    for (const w of warns) lines.push(`- [${w.section}] ${w.message}`);
    lines.push("");
  }
  if (diffResult && diffResult.changed.length > 0) {
    lines.push("## Amount changes vs baseline");
    lines.push("");
    lines.push(`Baseline: ${baselineRef}. ${diffResult.changed.length} changed, ${diffResult.warned.length} over +/-30%.`);
    lines.push("");
    for (const entry of diffResult.changed) {
      const pctText = entry.zeroToNonZero
        ? "was $0, now $" + entry.new
        : `${(entry.pct * 100).toFixed(1)}% ($${entry.old} -> $${entry.new})`;
      const flag = diffResult.warned.includes(entry) ? " **SPIKE**" : "";
      lines.push(`- ${entry.item_id} (${entry.juris_id}) ${entry.field}: ${pctText}${flag}`);
    }
    lines.push("");
  }
  if (infos.length > 0) {
    lines.push("## Info");
    lines.push("");
    for (const i of infos) lines.push(`- [${i.section}] ${i.message}`);
    lines.push("");
  }
  if (missingByJuris.size > 0) {
    lines.push("## Missing sources / checked dates by jurisdiction");
    lines.push("");
    for (const [juris, items] of [...missingByJuris.entries()].sort()) {
      lines.push(`- **${juris}** (${items.length}): ${items.join("; ")}`);
    }
    lines.push("");
  }
  lines.push("## PASS");
  lines.push("");
  for (const p of passes) lines.push(`- [${p.section}] ${p.message}`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- The checked date (`last_verified`) is stored as ISO (\"2026-10-16\") or human (\"7 Oct 2026\"); both are accepted. The CSVs store ISO dates only.");
  lines.push("- \"Official government source\" cannot be proven from the URL string alone (school districts use .org, water districts .com/.org). The audit checks the URL is an external http(s) link; that it points to an official document is established by the human verification behind status \"verified\".");
  lines.push("- $0 is a legitimate fee value here (exemptions, shared connections, jurisdictions that levy no such fee), so zero amounts are not flagged. Only non-numeric, negative, and extreme values are.");
  lines.push("- Extreme-value thresholds are heuristics (per-sq-ft rate above $50/sq ft, flat/base above $100,000) and warn only — the highest legitimate rates on file are $27.55/sq ft (Encinitas DIF) and $12.46/sq ft (Level II school fee).");
  lines.push("- Unverified rows are marked by status \"to_verify\" in fees.json (the literal \"[확인 필요]\" string is forbidden in reader text by the site's own build gate, E5).");
  lines.push("- This script overlaps with scripts/audit-everylineitem.mjs on source/date and CSV-integrity checks; it adds the git-diff spike detection. The broad gate also covers disclaimers, banned phrases, and the 6-step model.");
  lines.push("");

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");

  console.log(`fee audit: ${fails.length === 0 ? "PASS" : "FAIL"} — ${fails.length} FAIL, ${warns.length} WARN, ${passes.length} PASS`);
  console.log(`Report: docs/fee-audit-report.md`);
  for (const f of fails) console.log(`FAIL [${f.section}] ${f.message}`);
  for (const w of warns) console.log(`WARN [${w.section}] ${w.message}`);
  process.exitCode = fails.length > 0 ? 1 : 0;
}

// Run only when executed directly (not when imported for testing).
// process.argv[1] is undefined for `node -e` / --input-type=module, so
// check it before calling pathToFileURL.
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
