#!/usr/bin/env node
// check-fee-sources.mjs — watch the official fee-schedule pages behind
// the fee ledger and report changes for human review.
//
// What it does
//   Reads scripts/fee-watch-list.json (10 jurisdictions, each with its
//   official fee_schedule_url), fetches each page through the Firecrawl
//   API, extracts the dollar-amount lines from the page markdown, and
//   compares them with the previous snapshot in scripts/snapshots/.
//
// What it never does
//   It NEVER modifies src/data/fees.json, any public CSV, or any page.
//   A changed, missing, or unparseable source is only recorded as a
//   [확인 필요] entry in docs/fee-audit-report.md, for a human to
//   re-verify against the official document (see CLAUDE.md rule 2).
//   That is the whole point: an estimate must never be written into
//   the data by a script.
//
// Usage
//   FIRECRAWL_API_KEY=... node scripts/check-fee-sources.mjs
//   node scripts/check-fee-sources.mjs --mock [--mock-v2] [--report <path>] [--snapshots <dir>]
//
//   --mock     Run the full pipeline against built-in mock pages (no
//              API key, no network). Use --mock-v2 on a second run to
//              simulate a changed amount and a 404, and watch the
//              [확인 필요] entries appear.
//   --report   Where to append the run section (default:
//              docs/fee-audit-report.md).
//   --snapshots  Snapshot directory (default: scripts/snapshots/;
//              --mock defaults to a temp dir so test snapshots never
//              touch the real ones).
//
// Limits
//   MAX_CALLS = 10, hardcoded. One run makes at most 10 Firecrawl
//   calls, even if the watch list grows. Calls are sequential with a
//   short delay between them (free-tier politeness).
//
// Exit codes
//   0  all pages unchanged, or only baselines written
//   1  at least one [확인 필요] entry was recorded
//   2  usage / config error (no FIRECRAWL_API_KEY and no --mock,
//      unreadable watch list, ...).
//
// NOTE on docs/fee-audit-report.md: scripts/audit-fees.mjs regenerates
// that file on every run, which wipes sections appended here. Copy any
// [확인 필요] entry to docs/REVIEW_NEEDED.md (the human review queue,
// see CLAUDE.md) before running the audit, or the finding will be lost.

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const MAX_CALLS = 10; // hard cap: one run, at most 10 Firecrawl calls
const CALL_DELAY_MS = 500; // politeness delay between sequential calls
const REQUEST_TIMEOUT_MS = 60_000;
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

const WATCH_LIST_PATH = path.join(__dirname, "fee-watch-list.json");
const DEFAULT_SNAPSHOTS_DIR = path.join(__dirname, "snapshots");
const DEFAULT_REPORT_PATH = path.join(REPO_ROOT, "docs", "fee-audit-report.md");

const today = () =>
  // YYYY-MM-DD in the site's timezone (Asia/Seoul). toISOString() would
  // give the UTC date, which is a day behind after 09:00 KST.
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

// ---------------------------------------------------------------------------
// Amount-line extraction
// ---------------------------------------------------------------------------

// A "dollar-amount line" is a markdown line that states a fee. Keep the
// whole line (trimmed, whitespace collapsed) so a changed amount, a
// changed unit, or a reworded fee all show up as a diff.
const DOLLAR_RE = /\$[\d,]+(?:\.\d{1,2})?/;
const PER_SQFT_RE = /\b\d+(?:\.\d{1,2})?\s*(?:per\s+sq\.?\s*ft|per\s+square\s+foot)\b/i;

function extractAmountLines(markdown) {
  const lines = new Set();
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (DOLLAR_RE.test(line) || PER_SQFT_RE.test(line)) lines.add(line);
  }
  return [...lines].sort();
}

function contentHash(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Firecrawl
// ---------------------------------------------------------------------------

async function fetchViaFirecrawl(url, apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 45_000,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    const markdown = body?.data?.markdown ?? body?.markdown ?? null;
    if (typeof markdown !== "string" || !markdown.trim()) {
      return { ok: false, status: res.status, error: "no markdown returned" };
    }
    return { ok: true, status: res.status, markdown };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, status: 0, error: "timeout" };
    }
    return { ok: false, status: 0, error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Mock pages (for --mock / --mock-v2). No network, no key.
// Variant A is the baseline; variant B changes one amount (PASADENA)
// and 404s another (BUENA-PARK). Everything else is identical, so a
// second run with --mock-v2 exercises the change and error paths.
// ---------------------------------------------------------------------------

const MOCK_PAGES = {
  "SAN-LUIS-OBISPO-COUNTY": {
    A: "# County Fees\n\nBuilding permit: $1,250 flat.\nPlan check: $625 (50% of permit).\nSchool fee: $5.38 per sq ft.\n",
    B: "# County Fees\n\nBuilding permit: $1,250 flat.\nPlan check: $625 (50% of permit).\nSchool fee: $5.38 per sq ft.\n",
  },
  "SANTA-CLARA-COUNTY": {
    A: "# Building Fees\n\nPermit fee: $2,100 flat.\nImpact fee: $3.10 per sq ft.\n",
    B: "# Building Fees\n\nPermit fee: $2,100 flat.\nImpact fee: $3.10 per sq ft.\n",
  },
  PASADENA: {
    A: "# Master Fee Schedule\n\nADU permit: $1,006 flat.\nPlan check: $450 flat.\n",
    B: "# Master Fee Schedule\n\nADU permit: $1,102 flat.\nPlan check: $450 flat.\n",
  },
  "BUENA-PARK": {
    A: "# Water / Sewer Fees\n\nConnection fee: $4,800 flat.\nCapacity charge: $2.15 per sq ft.\n",
    B: null, // 404 in variant B
  },
  ALHAMBRA: {
    A: "# Master Fee Schedule\n\nBuilding permit: $980 flat.\nSchool fee: $4.79 per sq ft.\n",
    B: "# Master Fee Schedule\n\nBuilding permit: $980 flat.\nSchool fee: $4.79 per sq ft.\n",
  },
  "LA-CITY": {
    A: "# LAMC Fee Table\n\nPermit: $395 + $3.50 per $1,000 valuation.\nPlan check: 90% of permit fee.\n",
    B: "# LAMC Fee Table\n\nPermit: $395 + $3.50 per $1,000 valuation.\nPlan check: 90% of permit fee.\n",
  },
  CARLSBAD: {
    A: "# Fee Schedule\n\nImpact fee: $12.46 per sq ft.\nPermit: $1,150 flat.\n",
    B: "# Fee Schedule\n\nImpact fee: $12.46 per sq ft.\nPermit: $1,150 flat.\n",
  },
  ARCADIA: {
    A: "# Development Fees\n\nPermit: $1,320 flat.\nSchool fee: $5.38 per sq ft.\n",
    B: "# Development Fees\n\nPermit: $1,320 flat.\nSchool fee: $5.38 per sq ft.\n",
  },
  "MARIN-COUNTY": {
    A: "# Building Permit Fees\n\nPermit: $1,050 flat.\nPlan check: $525 flat.\n",
    B: "# Building Permit Fees\n\nPermit: $1,050 flat.\nPlan check: $525 flat.\n",
  },
  "BEVERLY-HILLS": {
    A: "# Taxes, Fees and Charges\n\nPermit: $1,400 flat.\nImpact fee: $2.75 per sq ft.\n",
    B: "# Taxes, Fees and Charges\n\nPermit: $1,400 flat.\nImpact fee: $2.75 per sq ft.\n",
  },
};

function fetchMock(jurisId, variant) {
  const page = MOCK_PAGES[jurisId]?.[variant];
  if (page === undefined) {
    return { ok: false, status: 404, error: "no mock page for this jurisdiction" };
  }
  if (page === null) {
    return { ok: false, status: 404, error: "HTTP 404" };
  }
  return { ok: true, status: 200, markdown: page };
}

// ---------------------------------------------------------------------------
// Snapshots + report
// ---------------------------------------------------------------------------

function readSnapshot(dir, jurisId) {
  const file = path.join(dir, `${jurisId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeSnapshot(dir, jurisId, snapshot) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${jurisId}.json`),
    JSON.stringify(snapshot, null, 2) + "\n",
  );
}

function appendReport(reportPath, section) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  if (!fs.existsSync(reportPath)) {
    fs.writeFileSync(
      reportPath,
      "# Fee source monitor\n\n" +
        "Findings from `scripts/check-fee-sources.mjs`. Each run appends a dated section. " +
        "A `[확인 필요]` entry means a human must re-verify the rows that cite that source — " +
        "the script never changes the data itself. " +
        "NOTE: `scripts/audit-fees.mjs` regenerates this file, which wipes appended sections; " +
        "copy [확인 필요] entries to `docs/REVIEW_NEEDED.md` before running the audit.\n\n",
    );
  }
  fs.appendFileSync(reportPath, section);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { mock: false, mockV2: false, report: null, snapshots: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") opts.mock = true;
    else if (a === "--mock-v2") { opts.mock = true; opts.mockV2 = true; }
    else if (a === "--report") opts.report = argv[++i];
    else if (a === "--snapshots") opts.snapshots = argv[++i];
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else { console.error(`unknown argument: ${a}`); process.exit(2); }
  }
  return opts;
}

function printHelp() {
  console.log(`usage: node scripts/check-fee-sources.mjs [--mock [--mock-v2]] [--report <path>] [--snapshots <dir>]
  FIRECRAWL_API_KEY must be set unless --mock is given.`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const apiKey = process.env.FIRECRAWL_API_KEY ?? "";
  if (!opts.mock && !apiKey) {
    console.error(
      "FIRECRAWL_API_KEY is not set. Set it, or run with --mock to test " +
        "against built-in mock pages (no network, no key).",
    );
    process.exit(2);
  }

  let watchList;
  try {
    watchList = JSON.parse(fs.readFileSync(WATCH_LIST_PATH, "utf8"));
  } catch (err) {
    console.error(`cannot read ${WATCH_LIST_PATH}: ${err.message}`);
    process.exit(2);
  }
  const all = watchList.jurisdictions ?? [];
  const targets = all.slice(0, MAX_CALLS);
  const skipped = all.length - targets.length;

  const snapshotsDir =
    opts.snapshots ??
    (opts.mock
      ? path.join(os.tmpdir(), "fee-monitor-mock-snapshots")
      : DEFAULT_SNAPSHOTS_DIR);
  const reportPath = opts.report ?? DEFAULT_REPORT_PATH;
  const variant = opts.mockV2 ? "B" : "A";

  const date = today();
  const findings = []; // [확인 필요] entries
  const unchanged = [];
  const baselines = [];
  const infos = [];
  let calls = 0;

  for (const [index, j] of targets.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, CALL_DELAY_MS));
    calls++;

    const result = opts.mock
      ? fetchMock(j.juris_id, variant)
      : await fetchViaFirecrawl(j.fee_schedule_url, apiKey);

    if (!result.ok) {
      findings.push({
        juris_id: j.juris_id,
        name: j.name,
        url: j.fee_schedule_url,
        date,
        kind: "fetch error",
        detail: `Fetch failed (${result.error}). The official page could not be read, so nothing was compared and the previous snapshot was kept.`,
      });
      console.log(`[확인 필요] ${j.juris_id}: fetch failed (${result.error})`);
      continue;
    }

    const amountLines = extractAmountLines(result.markdown);
    const snapshot = readSnapshot(snapshotsDir, j.juris_id);
    const hash = contentHash(result.markdown);

    if (!snapshot) {
      writeSnapshot(snapshotsDir, j.juris_id, {
        juris_id: j.juris_id,
        url: j.fee_schedule_url,
        checked_date: date,
        amount_lines: amountLines,
        content_hash: hash,
      });
      baselines.push(j.juris_id);
      console.log(`baseline: ${j.juris_id} (${amountLines.length} amount lines)`);
      continue;
    }

    // Snapshot kept on every successful read, even when unchanged, so
    // the checked date stays current.
    writeSnapshot(snapshotsDir, j.juris_id, {
      juris_id: j.juris_id,
      url: j.fee_schedule_url,
      checked_date: date,
      amount_lines: amountLines,
      content_hash: hash,
    });

    if (amountLines.length === 0) {
      findings.push({
        juris_id: j.juris_id,
        name: j.name,
        url: j.fee_schedule_url,
        date,
        kind: "no amounts found",
        detail:
          "The page was fetched, but no dollar-amount lines could be extracted. The page structure may have changed, or the fee table may have moved. A human should open the official page and check.",
      });
      console.log(`[확인 필요] ${j.juris_id}: no dollar-amount lines found`);
      continue;
    }

    const prev = new Set(snapshot.amount_lines ?? []);
    const next = new Set(amountLines);
    const added = amountLines.filter((l) => !prev.has(l));
    const removed = (snapshot.amount_lines ?? []).filter((l) => !next.has(l));

    if (added.length === 0 && removed.length === 0) {
      if (hash !== snapshot.content_hash) {
        infos.push(`${j.juris_id}: page changed, but no fee amounts changed.`);
      }
      unchanged.push(j.juris_id);
      console.log(`unchanged: ${j.juris_id}`);
      continue;
    }

    const before = removed.length ? removed.map((l) => `  - ${l}`).join("\n") : "  (none)";
    const after = added.length ? added.map((l) => `  + ${l}`).join("\n") : "  (none)";
    findings.push({
      juris_id: j.juris_id,
      name: j.name,
      url: j.fee_schedule_url,
      date,
      kind: "amounts changed",
      detail:
        `Dollar-amount lines changed since the ${snapshot.checked_date ?? "previous"} snapshot.\n` +
        `Before:\n${before}\nAfter:\n${after}`,
    });
    console.log(`[확인 필요] ${j.juris_id}: amount lines changed`);
  }

  // --- report section (appended; never overwrites the data) ---
  const lines = [];
  lines.push(`## ${date} — fee source check\n`);
  lines.push(
    `- Calls: ${calls} Firecrawl call(s) (cap ${MAX_CALLS}); ` +
      `unchanged ${unchanged.length}, baselines ${baselines.length}, ` +
      `[확인 필요] ${findings.length}.` +
      (skipped > 0 ? ` ${skipped} watch-list entr${skipped === 1 ? "y" : "ies"} skipped by the cap.` : ""),
  );
  if (infos.length) {
    lines.push(`- Info: ${infos.join(" ")}`);
  }
  if (unchanged.length) lines.push(`- Unchanged: ${unchanged.join(", ")}.`);
  if (baselines.length) lines.push(`- Baseline written (nothing to compare yet): ${baselines.join(", ")}.`);
  lines.push("");
  for (const f of findings) {
    lines.push(`### [확인 필요] ${f.juris_id} — ${f.name}`);
    lines.push("");
    lines.push(`- Official URL: ${f.url}`);
    lines.push(`- Checked: ${f.date}`);
    lines.push(`- What happened: ${f.kind}`);
    lines.push("");
    for (const d of f.detail.split("\n")) lines.push(d);
    lines.push("");
  }
  if (findings.length === 0) {
    lines.push("No [확인 필요] items this run.");
    lines.push("");
  }
  appendReport(reportPath, lines.join("\n"));

  console.log(
    `\nDone: ${calls} call(s), ${unchanged.length} unchanged, ` +
      `${baselines.length} baseline(s), ${findings.length} [확인 필요]. ` +
      `Report: ${reportPath}`,
  );
  process.exit(findings.length > 0 ? 1 : 0);
}

main();
