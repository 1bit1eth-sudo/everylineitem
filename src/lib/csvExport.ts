// Build-time CSV export: generates the public fee-index CSV from fees.json.
// Verified rows only; the 800 sq ft amount uses the same calcLine math as
// the site calculator, so the CSV can never disagree with the pages.
// Called from astro.config.ts (top level, before `astro build` copies
// public/ into dist/), and reused by check-quality's E8 consistency check.
import { mkdirSync, writeFileSync } from "node:fs";
import { calcLine, type FeeData, type FeeItem } from "./feeCalc";

/** Today's date in Asia/Seoul (the site's dates are KST), YYYY-MM-DD. */
export function csvExportDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function csvFileNames(date: string): {
  dated: string;
  latest: string;
  legacy: string;
} {
  return {
    dated: `adu-fee-index-${date}.csv`,
    latest: "adu-fee-index-latest.csv",
    legacy: "adu-fee-index-2026-q3.csv",
  };
}

// Rate text, ported from the fee page's skippedRateLabel (src/pages/fees/
// [slug].astro) so the CSV never claims a basis the schedule does not
// state: several pct_valuation rows are percentages of the permit fee,
// and two old rows store the rate as whole percent-points (2 = 2%) while
// newer rows store a decimal fraction (0.85 = 85%). The fee name's
// "(…% of …)" parenthetical, when present, is the schedule's own wording
// and wins. Flat rows carry the dollar amount (the page shows "flat fee"
// because its amount column already has the figure; the CSV needs the
// rate itself here).
const pctStr = (rate: number): string => {
  const v = rate > 1 ? rate : rate * 100;
  return String(parseFloat(v.toFixed(4)));
};
// fmtUSD rounds to whole dollars — wrong for schedule bases that carry
// cents ($2,738.66). Keep cents only when the value has them.
const fmtMoney = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

export function csvRateLabel(item: FeeItem): string {
  if (item.method === "per_sqft") {
    if (item.rate_low == null) return "";
    const r = `$${item.rate_low}/sq ft`;
    return item.rate_high != null && item.rate_high !== item.rate_low
      ? `$${item.rate_low}–$${item.rate_high}/sq ft`
      : r;
  }
  if (item.method === "flat") {
    if (item.rate_low == null) return "";
    return item.rate_high != null && item.rate_high !== item.rate_low
      ? `${fmtMoney(item.rate_low)}–${fmtMoney(item.rate_high)}`
      : fmtMoney(item.rate_low);
  }
  if (item.method === "valuation_step") {
    if (item.step === 1) {
      return `${pctStr(item.rate_low ?? 0)}% of valuation above ${fmtMoney(item.threshold ?? 0)}`;
    }
    return `${fmtMoney(item.base ?? 0)} + $${Number(item.rate_low ?? 0).toFixed(2)} per $${Number(item.step ?? 0).toLocaleString("en-US")} over ${fmtMoney(item.threshold ?? 0)} valuation`;
  }
  if (item.method === "pct_valuation") {
    if (item.rate_low == null) return "";
    const pct = pctStr(item.rate_low);
    const paren = /\(([^)]*%[^)]*)\)/.exec(item.fee_name ?? "");
    if (paren) {
      return paren[1]
        .replace(/,\s*LA County schedule$/, "")
        .replace(/,\s*LA County$/, "");
    }
    const notes = item.notes ?? "";
    if (/of the building permit fee/i.test(notes))
      return `${pct}% of permit fee`;
    if (
      /of permit & plan check/i.test(notes) ||
      /of all building plan check and permit fees/i.test(notes)
    )
      return `${pct}% of permit & plan check`;
    return `${pct}% of valuation`;
  }
  return "see fee schedule";
}

/**
 * Amount of one verified row on an 800 sq ft ADU, same math as the site
 * calculator (800 sq ft, 1,600 sq ft primary dwelling for prorated lines).
 * Plain number (no $ or commas) so the column stays machine-readable; a
 * range is "low-high". Empty when the row has no computable amount at
 * 800 sq ft (skipped: no valuation basis on file; out of scope: the row
 * does not apply at this size) — never guessed.
 */
export function csvAmount800(
  item: FeeItem,
  juris: FeeData["jurisdictions"][number],
  rules: FeeData["rules"]
): string {
  const line = calcLine(item, juris, 800, rules);
  if (line.kind === "ok") {
    return line.high != null && line.high !== line.low
      ? `${line.low}-${line.high}`
      : String(line.low);
  }
  if (line.kind === "exempt") return "0";
  return "";
}

const csvEscape = (v: string | null | undefined): string => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEADER =
  "jurisdiction,county,fee_name,category,rate,amount_800_sqft,status,source_url,last_verified,effective_date";

export function buildFeeCsv(
  feesData: FeeData,
  date: string
): { text: string; rows: number; jurisdictions: number } {
  const names = new Map(
    feesData.jurisdictions.map(j => [j.juris_id, j] as const)
  );
  const verified = feesData.fee_items
    .filter(i => i.status === "verified")
    .sort((a, b) => {
      const na = names.get(a.juris_id)?.name ?? a.juris_id;
      const nb = names.get(b.juris_id)?.name ?? b.juris_id;
      return (
        na.localeCompare(nb, "en-US") ||
        a.category.localeCompare(b.category, "en-US") ||
        a.fee_name.localeCompare(b.fee_name, "en-US")
      );
    });
  const jurisWithVerified = new Set(verified.map(i => i.juris_id)).size;
  const lines = verified.map(i => {
    const j = names.get(i.juris_id)!;
    return [
      j.name,
      j.county,
      i.fee_name,
      i.category,
      csvRateLabel(i),
      csvAmount800(i, j, feesData.rules),
      i.status,
      i.source_url ?? "",
      i.last_verified ?? "",
      i.effective_date ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });
  const text = [
    "# Source: Every Line Item — California ADU Fee Index. https://everylineitem.com/fee-index/",
    "# License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) — free to reuse with attribution.",
    `# Reference date: ${date} (generated at build time from src/data/fees.json)`,
    `# Scope: verified rows only — ${verified.length} verified line items across ${jurisWithVerified} jurisdictions. Unverified rows are excluded, never estimated.`,
    "# Amount at 800 sq ft: computed with the same math as the site calculator (800 sq ft ADU; 1,600 sq ft primary dwelling for prorated lines). Blank = the row has no computable amount at 800 sq ft. A range is shown as low-high.",
    HEADER,
    ...lines,
    "",
  ].join("\n");
  return { text, rows: verified.length, jurisdictions: jurisWithVerified };
}

/**
 * Write the three public CSV paths (dated, latest, legacy q3 alias) with
 * identical generated content. Called from astro.config.ts at config load,
 * before `astro build` copies public/ into dist/.
 */
export function generateFeeCsvFiles(feesData: FeeData): {
  date: string;
  rows: number;
  jurisdictions: number;
  files: string[];
} {
  const date = csvExportDate();
  const { text, rows, jurisdictions } = buildFeeCsv(feesData, date);
  const names = csvFileNames(date);
  mkdirSync("public/downloads", { recursive: true });
  const files = [names.dated, names.latest, names.legacy].map(n => {
    writeFileSync(`public/downloads/${n}`, text, "utf8");
    return n;
  });
  return { date, rows, jurisdictions, files };
}
