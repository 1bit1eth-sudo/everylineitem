// ---------------------------------------------------------------------------
// SB 1117 landing pages (/sb-1117/ and /sb-1117/[slug]/).
//
// Thin aggregation layer over calcSB1117: verified rows only, and for
// jurisdictions with mutually exclusive area schedules (Ontario) every area
// is computed separately and reported as a min–max range — never summed.
// No new fee logic lives here; if a number looks wrong, fix feeCalc.ts.
// ---------------------------------------------------------------------------

import {
  calcSB1117,
  jurisAreas,
  type FeeData,
  type Jurisdiction,
  type SB1117Result,
} from "@/lib/feeCalc";

/** Sizes shown on every page. 800 is the series default; 1,000 and 1,200 are
 * where SB 1117 matters most (largest excess over 750). */
export const SB1117_SIZES = [800, 1000, 1200] as const;

/** SB 1117 effective date (Chapter 809). Pages flip copy at build time. */
export const SB1117_EFFECTIVE = new Date("2027-01-01T00:00:00-08:00");

export interface Span {
  low: number;
  high: number;
}

export interface SB1117Summary {
  sqft: number;
  current: Span;
  future: Span;
  /** 2027 total with unconvertible flat lines carried at their 2026 amount —
   * the conservative bill. current − futureCarried = savings, so tables add up. */
  futureCarried: Span;
  savings: Span;
  uncertain: Span;
  hasImpactLines: boolean;
  /** Per-area results when the jurisdiction has area schedules. */
  byArea: { area: string; result: SB1117Result }[];
  /** First (or only) result, for line-level tables. */
  primary: SB1117Result;
}

const span = (vals: [number, number | null][]): Span => ({
  low: Math.min(...vals.map(([l]) => l)),
  high: Math.max(...vals.map(([l, h]) => h ?? l)),
});

export function summarizeSB1117(
  data: FeeData,
  jurisId: string,
  sqft: number
): SB1117Summary {
  const areas = jurisAreas(data, jurisId);
  const runs =
    areas.length > 0
      ? areas.map(a => ({
          area: a,
          result: calcSB1117(data, jurisId, sqft, {
            area: a,
            verifiedOnly: true,
          }),
        }))
      : [
          {
            area: "",
            result: calcSB1117(data, jurisId, sqft, { verifiedOnly: true }),
          },
        ];
  const rs = runs.map(r => r.result);
  return {
    sqft,
    current: span(rs.map(r => [r.currentLow, r.currentHigh])),
    future: span(rs.map(r => [r.futureLow, r.futureHigh])),
    futureCarried: span(
      rs.map(r => [
        r.futureLow + r.uncertainLow,
        (r.futureHigh ?? r.futureLow) + (r.uncertainHigh ?? r.uncertainLow),
      ])
    ),
    savings: span(rs.map(r => [r.savingsLow, r.savingsHigh])),
    uncertain: span(rs.map(r => [r.uncertainLow, r.uncertainHigh])),
    hasImpactLines: rs.some(r => r.hasImpactLines),
    byArea: areas.length > 0 ? runs : [],
    primary: rs[0],
  };
}

export function fmtSpan(s: Span): string {
  const f = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  return s.high !== s.low ? `${f(s.low)}–${f(s.high)}` : f(s.low);
}

/** Real jurisdictions only (drops the synthetic LA series baseline). */
export function realJurisdictions(data: FeeData): Jurisdiction[] {
  return data.jurisdictions.filter(j => j.juris_id !== "LA-BASE");
}

/** Has at least one verified fee row of any category. Pages without one are
 * generated but noindexed, matching /fees/[slug]. */
export function hasVerifiedRows(data: FeeData, jurisId: string): boolean {
  return data.fee_items.some(
    i => i.juris_id === jurisId && i.status === "verified"
  );
}

/** Whole days from `now` until SB 1117 takes effect (0 once in force). */
export function daysUntilSB1117(now = new Date()): number {
  const ms = SB1117_EFFECTIVE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
