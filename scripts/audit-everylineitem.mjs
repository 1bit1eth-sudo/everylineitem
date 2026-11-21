#!/usr/bin/env node
// everylineitem audit gate — no external dependencies.
// Uses only Node.js built-ins (node:fs, node:path, node:url), so it runs
// immediately on any Node install, including Windows, with no `npm install`.
//
// What it checks (source files only — no build, no dist, no network):
//   A. fees.json (+ other src/data/*.json) parse integrity, and per fee item:
//      required keys, numeric integrity of money fields, and a primary source
//      URL + checked date (last_verified) on every verified row.
//   B. The 6-step construction model in src/lib/estimateXlsx.ts: phase
//      amounts are finite and >= 0, and the steps sum to the subtotal.
//   C. Benchmark CSVs in public/downloads/: broken rows, empty required
//      columns, NaN/negative amounts, and (for the benchmark ranges) that
//      low <= median <= high.
//   D. The quote checker (public/bid-scanner/index.html) and the property
//      tax calculator (src/pages/property-tax.astro) carry an educational
//      disclaimer ("not a quote" / "not tax advice" / "planning math, not
//      an assessment", ...).
//   E. Hard FAIL on wording that reads as a guaranteed construction price
//      or official tax/legal advice ("guaranteed cost", "official tax
//      advice", ...), case-insensitive, in reader-visible text.
//
// Exit code: 1 when any FAIL exists, otherwise 0. Warnings never fail.
// Report: reports/everylineitem-audit.md (created by this script).
//
// Usage: node scripts/audit-everylineitem.mjs   (from any directory)
//
// Notes on how this maps to the real repo (the task brief described a
// framework-less static site; the actual site is Astro + Cloudflare Worker):
//   - The fee data lives in src/data/fees.json (798 items), not in HTML.
//     Its "checked date" is `last_verified` (ISO "2026-10-16" or human
//     "7 Oct 2026" — both are parsed) and its primary source is `source_url`.
//   - `threshold` is a polymorphic field (a number OR a descriptive string
//     such as "800 sq ft ADU"), so it is NOT numeric-checked. Only the money
//     fields (rate_low, rate_high, base, step) are.
//   - adu-six-phase-worksheet.csv is a fill-in template: its "Your quote"
//     and "Our modeled median" cells are blank by design, so blank numeric
//     cells there are allowed. Blank amounts in the fee-index CSV are also
//     allowed (the file's own header comment says a blank means the row has
//     no computable amount at 800 sq ft).
//   - Unverified rows are marked by their `status` field ("to_verify"), not
//     by a literal "[확인 필요]" string — the site's own build gate (E5 in
//     scripts/check-quality.mjs) forbids that string in reader text.
//   - The banned-phrase scan covers reader-visible text only. `internal_notes`
//     in fees.json is excluded (it is never rendered).
//   - This script complements scripts/check-quality.mjs (which runs on the
//     built dist after `astro build`); it does not duplicate its E1–E11
//     rules, it checks the source files directly and adds the CSV,
//     disclaimer, and banned-phrase checks.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.join(ROOT, "reports", "everylineitem-audit.md");

const fails = [];
const warns = [];
const passes = [];

function fail(section, message) {
  fails.push({ section, message });
}
function warn(section, message) {
  warns.push({ section, message });
}
function pass(section, message) {
  passes.push({ section, message });
}

// ---------------------------------------------------------------- dates
const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

// Parse "2026-10-16" or "7 Oct 2026" into { y, m, d }. Null when unparseable.
function parseDate(value) {
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
function kstToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function dateKey({ y, m, d }) {
  return y * 10000 + m * 100 + d;
}

// ---------------------------------------------------------------- csv
// Minimal CSV parser: quoted fields, commas and newlines inside quotes,
// CRLF or LF line endings. Returns { header, rows } where rows are arrays
// of strings. Throws on a structurally broken file (unterminated quote).
function parseCsv(text, fileLabel) {
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
  // Drop trailing empty rows (trailing newline).
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  const nonComment = rows.filter((r) => !(r[0] && r[0].startsWith("#")));
  if (nonComment.length === 0) return { header: [], rows: [] };
  return { header: nonComment[0], rows: nonComment.slice(1) };
}

function isFiniteNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// ---------------------------------------------------------------- helpers
function readText(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

// ---------------------------------------------------------------- A. fees.json
const SECTION_A = "fees.json";
let fees = null;
try {
  fees = readJson("src/data/fees.json");
  pass(SECTION_A, "src/data/fees.json parses as JSON");
} catch (err) {
  fail(SECTION_A, `src/data/fees.json does not parse: ${err.message}`);
}

const REQUIRED_ITEM_KEYS = [
  "item_id", "juris_id", "category", "fee_name", "method",
  "confidence", "status",
];
// source_url and last_verified are NOT in the blanket list: their severity
// depends on status (FAIL for verified rows, WARN for to_verify rows) and
// is handled in the status branch below.
const MONEY_FIELDS = ["rate_low", "rate_high", "base", "step"];
const KNOWN_STATUSES = new Set(["verified", "to_verify", "illustrative", "conflict"]);
const FEE_ITEM_COUNT = fees && Array.isArray(fees.fee_items) ? fees.fee_items.length : 0;

if (fees) {
  if (!Array.isArray(fees.fee_items)) {
    fail(SECTION_A, "src/data/fees.json has no fee_items array");
  } else {
    const todayKey = dateKey(kstToday());
    // Per-jurisdiction rollup of missing sources/dates (for the report).
    const missingByJuris = new Map();
    const noteMissing = (item, what) => {
      const list = missingByJuris.get(item.juris_id) || [];
      list.push(`${item.item_id}: ${what}`);
      missingByJuris.set(item.juris_id, list);
    };

    for (const item of fees.fee_items) {
      const id = item.item_id || "(no item_id)";
      for (const key of REQUIRED_ITEM_KEYS) {
        if (item[key] === undefined || item[key] === null || String(item[key]).trim() === "") {
          fail(SECTION_A, `${id}: missing required key "${key}"`);
        }
      }
      if (item.status && !KNOWN_STATUSES.has(item.status)) {
        fail(SECTION_A, `${id}: unknown status "${item.status}"`);
      }
      for (const key of MONEY_FIELDS) {
        const v = item[key];
        if (v !== null && v !== undefined && v !== "") {
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
            fail(SECTION_A, `${id}: ${key} is not a finite non-negative number (${JSON.stringify(v)})`);
          }
        }
      }
      const status = item.status;
      const source = typeof item.source_url === "string" ? item.source_url.trim() : "";
      const checked = typeof item.last_verified === "string" ? item.last_verified.trim() : "";
      if (status === "verified" || status === "illustrative" || status === "conflict") {
        if (!/^https?:\/\//.test(source)) {
          fail(SECTION_A, `${id} (${item.juris_id}, ${status}): missing primary source URL`);
          noteMissing(item, "missing source_url");
        }
        const parsed = parseDate(checked);
        if (!parsed) {
          fail(SECTION_A, `${id} (${item.juris_id}, ${status}): missing or unparseable checked date (last_verified=${JSON.stringify(item.last_verified)})`);
          noteMissing(item, "missing/unparseable last_verified");
        } else if (dateKey(parsed) > todayKey) {
          fail(SECTION_A, `${id} (${item.juris_id}, ${status}): checked date is in the future (${checked})`);
        }
        if (/^https?:\/\/([^/]*\.)?everylineitem\.com\//i.test(source) && status === "verified") {
          warn(SECTION_A, `${id} (${item.juris_id}): verified row cites the site itself as its source (circular citation)`);
        }
      } else if (status === "to_verify") {
        // Unverified by design: the status field IS the "[needs checking]"
        // marker. A missing source or date is a warning, not a fail.
        if (!source) warn(SECTION_A, `${id} (${item.juris_id}, to_verify): no source_url recorded yet`);
        if (!checked) warn(SECTION_A, `${id} (${item.juris_id}, to_verify): no last_verified recorded yet`);
      }
    }
    if (fees.fee_items.length > 0) {
      pass(SECTION_A, `${fees.fee_items.length} fee items checked (source + checked date on verified rows)`);
    }

    // Jurisdiction metadata: every jurisdiction needs a primary fee-schedule
    // URL and a checked date of its own.
    if (Array.isArray(fees.jurisdictions)) {
      for (const j of fees.jurisdictions) {
        const jid = j.juris_id || "(no juris_id)";
        if (!/^https?:\/\//.test(typeof j.fee_schedule_url === "string" ? j.fee_schedule_url.trim() : "")) {
          fail(SECTION_A, `jurisdiction ${jid}: missing official fee_schedule_url`);
          noteMissing({ juris_id: jid, item_id: "(jurisdiction)" }, "missing fee_schedule_url");
        }
        if (!parseDate(typeof j.last_verified === "string" ? j.last_verified : "")) {
          fail(SECTION_A, `jurisdiction ${jid}: missing or unparseable last_verified`);
          noteMissing({ juris_id: jid, item_id: "(jurisdiction)" }, "missing/unparseable last_verified");
        }
      }
      pass(SECTION_A, `${fees.jurisdictions.length} jurisdictions checked (fee_schedule_url + last_verified)`);
    } else {
      fail(SECTION_A, "src/data/fees.json has no jurisdictions array");
    }

    // Keep the per-jurisdiction rollup for the report.
    globalThis.__missingByJuris = missingByJuris;
  }
}

// Other JSON data files: parse integrity only.
for (const rel of ["src/data/fee-changelog.json", "src/data/propertyTaxRates.json"]) {
  try {
    readJson(rel);
    pass("json-parse", `${rel} parses as JSON`);
  } catch (err) {
    fail("json-parse", `${rel} does not parse: ${err.message}`);
  }
}

// ---------------------------------------------------------------- B. 6-step model
const SECTION_B = "6-step model";
try {
  const src = readText("src/lib/estimateXlsx.ts");
  const stepsBlock = /const CONSTRUCTION_STEPS[^=]*=\s*\[([\s\S]*?)\];/.exec(src);
  if (!stepsBlock) {
    fail(SECTION_B, "src/lib/estimateXlsx.ts: CONSTRUCTION_STEPS not found");
  } else {
    const amounts = [...stepsBlock[1].matchAll(/\[\s*"[^"]+"\s*,\s*([^\]]+?)\s*\]/g)].map((m) => Number(m[1].trim()));
    if (amounts.length === 0) {
      fail(SECTION_B, "src/lib/estimateXlsx.ts: no phase amounts found in CONSTRUCTION_STEPS");
    } else {
      let bad = false;
      for (const n of amounts) {
        if (!Number.isFinite(n) || n < 0) {
          fail(SECTION_B, `construction phase amount is not a finite non-negative number (${n})`);
          bad = true;
        }
      }
      const subtotalMatch = /const CONSTRUCTION_SUBTOTAL\s*=\s*(\d[\d,]*)/.exec(src);
      const designMatch = /const DESIGN_COST\s*=\s*(\d[\d,]*)/.exec(src);
      if (!subtotalMatch) {
        fail(SECTION_B, "src/lib/estimateXlsx.ts: CONSTRUCTION_SUBTOTAL not found");
      } else {
        const subtotal = Number(subtotalMatch[1].replace(/,/g, ""));
        const sum = amounts.reduce((a, b) => a + b, 0);
        if (!bad && sum !== subtotal) {
          fail(SECTION_B, `construction phases sum to $${sum.toLocaleString("en-US")} but CONSTRUCTION_SUBTOTAL is $${subtotal.toLocaleString("en-US")}`);
        } else if (!bad) {
          pass(SECTION_B, `${amounts.length} construction phases sum to the $${subtotal.toLocaleString("en-US")} subtotal`);
        }
      }
      if (!designMatch) {
        fail(SECTION_B, "src/lib/estimateXlsx.ts: DESIGN_COST not found");
      } else if (!Number.isFinite(Number(designMatch[1].replace(/,/g, ""))) || Number(designMatch[1].replace(/,/g, "")) < 0) {
        fail(SECTION_B, "DESIGN_COST is not a finite non-negative number");
      } else {
        pass(SECTION_B, `design cost $${Number(designMatch[1].replace(/,/g, "")).toLocaleString("en-US")} (6th step)`);
      }
    }
  }
} catch (err) {
  fail(SECTION_B, `src/lib/estimateXlsx.ts could not be read: ${err.message}`);
}

// ---------------------------------------------------------------- C. benchmark CSVs
const SECTION_C = "benchmark CSVs";
const DOWNLOADS = "public/downloads";

// Fee-index CSVs: verified rows only, source + checked date required.
const FEE_INDEX_COLUMNS = [
  "jurisdiction", "county", "fee_name", "category", "rate",
  "amount_800_sqft", "status", "source_url", "last_verified", "effective_date",
];
let latestFeeIndexRows = null;
try {
  const files = readdirSync(path.join(ROOT, DOWNLOADS))
    .filter((f) => /^adu-fee-index-.*\.csv$/.test(f))
    .sort();
  if (files.length === 0) {
    fail(SECTION_C, "no adu-fee-index-*.csv found in public/downloads/");
  }
  for (const file of files) {
    const rel = `${DOWNLOADS}/${file}`;
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
      const lineNo = i + 1; // data-row number (comments/header excluded)
      if (row.length !== FEE_INDEX_COLUMNS.length) {
        fail(SECTION_C, `${rel} row ${lineNo}: broken row — ${row.length} columns, expected ${FEE_INDEX_COLUMNS.length}`);
        rowFails++;
        return;
      }
      const rec = Object.fromEntries(FEE_INDEX_COLUMNS.map((c, idx) => [c, row[idx]]));
      if (!rec.source_url.trim()) {
        fail(SECTION_C, `${rel} row ${lineNo} (${rec.jurisdiction} — ${rec.fee_name}): empty source_url`);
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
      // Blank amount is allowed (no computable amount at 800 sq ft); a
      // non-blank amount must be a number >= 0 or a "low-high" range
      // (the CSV's own header comment: "A range is shown as low-high").
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
  fail(SECTION_C, `could not list ${DOWNLOADS}: ${err.message}`);
}

// Latest fee-index CSV should agree with fees.json on the verified count.
if (latestFeeIndexRows !== null && fees && Array.isArray(fees.fee_items)) {
  const verifiedCount = fees.fee_items.filter((r) => r.status === "verified").length;
  if (latestFeeIndexRows !== verifiedCount) {
    warn(SECTION_C, `adu-fee-index-latest.csv has ${latestFeeIndexRows} rows but fees.json has ${verifiedCount} verified items (regenerate the CSV at build time)`);
  } else {
    pass(SECTION_C, `adu-fee-index-latest.csv row count (${latestFeeIndexRows}) matches fees.json verified count`);
  }
}

// Benchmark ranges CSV: numeric low/median/high, low <= median <= high, Notes present.
const RANGES_REL = `${DOWNLOADS}/adu-benchmark-ranges-2026-q3.csv`;
try {
  const parsed = parseCsv(readText(RANGES_REL), RANGES_REL);
  const expected = ["Phase", "Inland SoCal low", "Inland median", "Inland high", "Coastal low", "Coastal median", "Coastal high", "Notes"];
  if (parsed.header.join(",") !== expected.join(",")) {
    fail(SECTION_C, `${RANGES_REL}: unexpected header (${parsed.header.join(",")})`);
  } else {
    let rowFails = 0;
    for (const [i, row] of parsed.rows.entries()) {
      const phase = row[0] || `(row ${i + 1})`;
      if (row.length !== expected.length) {
        fail(SECTION_C, `${RANGES_REL} row ${i + 1} (${phase}): broken row — ${row.length} columns, expected ${expected.length}`);
        rowFails++;
        continue;
      }
      const nums = row.slice(1, 7);
      if (nums.some((v) => !isFiniteNonNegativeNumber(v.trim()))) {
        fail(SECTION_C, `${RANGES_REL} row ${i + 1} (${phase}): non-numeric or negative range value (${nums.join(", ")})`);
        rowFails++;
        continue;
      }
      const [il, im, ih, cl, cm, ch] = nums.map(Number);
      if (!(il <= im && im <= ih)) {
        fail(SECTION_C, `${RANGES_REL} row ${i + 1} (${phase}): inland range out of order (low ${il}, median ${im}, high ${ih})`);
        rowFails++;
      }
      if (!(cl <= cm && cm <= ch)) {
        fail(SECTION_C, `${RANGES_REL} row ${i + 1} (${phase}): coastal range out of order (low ${cl}, median ${cm}, high ${ch})`);
        rowFails++;
      }
      if (!row[7].trim()) {
        fail(SECTION_C, `${RANGES_REL} row ${i + 1} (${phase}): empty Notes`);
        rowFails++;
      }
    }
    if (rowFails === 0) pass(SECTION_C, `${RANGES_REL}: ${parsed.rows.length} phase rows, ranges ordered low <= median <= high with notes`);
  }
} catch (err) {
  fail(SECTION_C, `${RANGES_REL} could not be read: ${err.message}`);
}

// Six-phase worksheet CSV: a fill-in template. "Your quote" and "Our modeled
// median" cells are blank by design; only Phase + Notes are required.
const WORKSHEET_REL = `${DOWNLOADS}/adu-six-phase-worksheet.csv`;
try {
  const parsed = parseCsv(readText(WORKSHEET_REL), WORKSHEET_REL);
  const expected = ["Phase", "Your quote ($)", "Our modeled median ($)", "Notes"];
  if (parsed.header.join(",") !== expected.join(",")) {
    fail(SECTION_C, `${WORKSHEET_REL}: unexpected header (${parsed.header.join(",")})`);
  } else {
    let rowFails = 0;
    const phases = parsed.rows.map((r) => r[0]);
    if (!phases.includes("Total")) {
      fail(SECTION_C, `${WORKSHEET_REL}: no Total row`);
      rowFails++;
    }
    for (const [i, row] of parsed.rows.entries()) {
      if (row.length !== expected.length) {
        fail(SECTION_C, `${WORKSHEET_REL} row ${i + 1}: broken row — ${row.length} columns, expected ${expected.length}`);
        rowFails++;
        continue;
      }
      if (!row[0].trim()) {
        fail(SECTION_C, `${WORKSHEET_REL} row ${i + 1}: empty Phase`);
        rowFails++;
      }
      if (!row[3].trim() && row[0].trim() !== "Total") {
        fail(SECTION_C, `${WORKSHEET_REL} row ${i + 1} (${row[0]}): empty Notes`);
        rowFails++;
      }
      for (const v of [row[1], row[2]]) {
        if (v.trim() !== "" && !isFiniteNonNegativeNumber(v.trim())) {
          fail(SECTION_C, `${WORKSHEET_REL} row ${i + 1} (${row[0]}): non-numeric amount (${JSON.stringify(v)})`);
          rowFails++;
        }
      }
    }
    if (rowFails === 0) pass(SECTION_C, `${WORKSHEET_REL}: ${parsed.rows.length} rows (fill-in template; blank quote cells are by design)`);
  }
} catch (err) {
  fail(SECTION_C, `${WORKSHEET_REL} could not be read: ${err.message}`);
}

// ---------------------------------------------------------------- D. disclaimers
const SECTION_D = "disclaimers";
const DISCLAIMER_MARKERS = [
  "not a quote",
  "not quotes",
  "not tax advice",
  "not legal advice",
  "not financial advice",
  "not professional advice",
  "planning math, not an assessment",
  "not an assessment",
  "educational purposes",
  "modeled, not quotes",
];
function checkDisclaimer(rel, label) {
  let text;
  try {
    text = readText(rel);
  } catch (err) {
    fail(SECTION_D, `${label} (${rel}): file could not be read — ${err.message}`);
    return;
  }
  const lower = text.toLowerCase();
  const found = DISCLAIMER_MARKERS.filter((m) => lower.includes(m));
  if (found.length === 0) {
    fail(SECTION_D, `${label} (${rel}): no educational disclaimer found (looked for: ${DISCLAIMER_MARKERS.join("; ")})`);
    return;
  }
  // Quote the first matching line as evidence.
  const lines = text.split(/\r?\n/);
  let evidence = "";
  for (const line of lines) {
    const l = line.toLowerCase();
    if (found.some((m) => l.includes(m))) {
      evidence = line.replace(/<[^>]+>/g, "").trim().slice(0, 160);
      break;
    }
  }
  pass(SECTION_D, `${label} (${rel}): disclaimer present — "${found.join('", "')}"${evidence ? ` — e.g. "${evidence}"` : ""}`);
}
checkDisclaimer("public/bid-scanner/index.html", "Bid Scanner (quote checker)");
checkDisclaimer("src/pages/property-tax.astro", "Property tax calculator");
// Recommendation, not a fail: the tax calculator does not use the literal
// "not tax advice" wording the brief asks for.
try {
  const taxPage = readText("src/pages/property-tax.astro").toLowerCase();
  if (!taxPage.includes("not tax advice")) {
    warn(SECTION_D, "Property tax calculator carries \"planning math, not an assessment\" but not the literal \"not tax advice\" wording — consider adding it");
  }
} catch {
  // Already reported by checkDisclaimer.
}

// ---------------------------------------------------------------- E. banned phrases
const SECTION_E = "banned phrases";
const BANNED = [
  "guaranteed cost",
  "guaranteed price",
  "official tax advice",
  "official legal advice",
];
const SCAN_FILES = [];
function collectFiles(dir, exts) {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(rel, exts);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      SCAN_FILES.push(rel);
    }
  }
}
collectFiles("src/content", [".md", ".mdx"]);
collectFiles("src/pages", [".astro"]);
SCAN_FILES.push("public/bid-scanner/index.html");
let bannedHits = 0;
for (const rel of SCAN_FILES) {
  let text;
  try {
    text = readText(rel);
  } catch {
    continue;
  }
  const lower = text.toLowerCase();
  for (const phrase of BANNED) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      const lineNo = text.slice(0, idx).split("\n").length;
      fail(SECTION_E, `${rel}:${lineNo}: banned phrase "${phrase}"`);
      bannedHits++;
      idx = lower.indexOf(phrase, idx + phrase.length);
    }
  }
}
// fees.json reader-visible fields (fee_name, notes, source_note). internal_notes
// is never rendered, so it is excluded from this scan.
if (fees && Array.isArray(fees.fee_items)) {
  for (const item of fees.fee_items) {
    const haystack = [item.fee_name, item.notes, item.source_note]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();
    for (const phrase of BANNED) {
      if (haystack.includes(phrase)) {
        fail(SECTION_E, `fees.json ${item.item_id}: banned phrase "${phrase}" in a reader-visible field`);
        bannedHits++;
      }
    }
  }
}
if (bannedHits === 0) {
  pass(SECTION_E, `no banned phrases in ${SCAN_FILES.length} content/page files + fees.json reader-visible fields (${BANNED.map((b) => `"${b}"`).join(", ")})`);
}

// ---------------------------------------------------------------- report
const today = new Date();
const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
const missingByJuris = globalThis.__missingByJuris || new Map();

const lines = [];
lines.push("# everylineitem audit");
lines.push("");
lines.push(`- Date: ${dateStr} (KST)`);
lines.push(`- Script: scripts/audit-everylineitem.mjs (Node built-ins only, no packages)`);
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
lines.push("- The fee data lives in src/data/fees.json; the site is Astro + Cloudflare Worker, not a framework-less static site. The audit reads the real data files.");
lines.push("- `threshold` in fees.json is a descriptive string or a number, so it is not numeric-checked; only rate_low / rate_high / base / step are.");
lines.push("- adu-six-phase-worksheet.csv is a fill-in template: blank quote/median cells are by design. Blank amount_800_sqft in the fee-index CSV means the row has no computable amount at 800 sq ft; a non-blank amount may be a single number or a low-high range.");
lines.push("- Unverified rows are marked by status \"to_verify\" in fees.json (the literal \"[확인 필요]\" string is forbidden in reader text by the site's own build gate, E5).");
lines.push("- Construction phases are modeled from the Los Angeles County baseline (no city publishes phase-level construction costs); their source is the benchmark ranges CSV and the posts it cites, not a government fee schedule.");
lines.push("- This script complements scripts/check-quality.mjs (which runs on the built dist); it checks source files directly and adds the CSV, disclaimer, and banned-phrase checks.");
lines.push("");

mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");

// ---------------------------------------------------------------- console + exit
console.log(`everylineitem audit: ${fails.length === 0 ? "PASS" : "FAIL"} — ${fails.length} FAIL, ${warns.length} WARN, ${passes.length} PASS`);
console.log(`Report: reports/everylineitem-audit.md`);
for (const f of fails) console.log(`FAIL [${f.section}] ${f.message}`);
for (const w of warns) console.log(`WARN [${w.section}] ${w.message}`);
process.exitCode = fails.length > 0 ? 1 : 0;
