// ADU property tax calculator — pure math only, no DOM.
// Sources: BOE "New Construction" page (R&TC §70), county BOE averages
// (BOE 2024-25 Annual Report, FY 2024-25) and representative TRA rates
// read directly from county tax rate books. See src/data/propertyTaxRates.json.

export type CountyRate = {
  county: string;
  rate_pct: number;
  fiscal_year: string;
  source_url: string;
  tra_book_label: string | null;
  tra_book_url: string | null;
  example_tra: {
    place: string;
    tra: string;
    rate_pct: number;
    fiscal_year: string;
    source_url: string;
  } | null;
};

export type PropertyTaxData = {
  source: string;
  source_url: string;
  fiscal_year: string;
  last_verified: string;
  note: string;
  counties: CountyRate[];
};

/** Default added market value at 800 sq ft, from the site's six-phase
 *  totals for an 800 sq ft ADU ($305,000–$325,000). Labeled "Modeled" —
 *  construction cost is not assessed value. */
export const DEFAULT_SQFT = 800;
export const DEFAULT_ADDED_VALUE = 310000;
export const MIN_SQFT = 200;
export const MAX_SQFT = 1200;

/** Modeled default added value for a given ADU size: linear scale of the
 *  800 sq ft default, rounded to the nearest $1,000. */
export function defaultAddedValue(sqft: number): number {
  const raw = (DEFAULT_ADDED_VALUE * sqft) / DEFAULT_SQFT;
  return Math.round(raw / 1000) * 1000;
}

/** Added tax per year, rounded to the nearest dollar. */
export function annualTax(addedValue: number, ratePct: number): number {
  if (!Number.isFinite(addedValue) || !Number.isFinite(ratePct)) return 0;
  if (addedValue <= 0 || ratePct <= 0) return 0;
  return Math.round((addedValue * ratePct) / 100);
}

/** Monthly equivalent of an annual amount, rounded to the nearest dollar. */
export function monthlyTax(annual: number): number {
  if (!Number.isFinite(annual) || annual <= 0) return 0;
  return Math.round(annual / 12);
}

/** Months of supplemental assessment after completion, through June 30
 *  (end of the California fiscal year, R&TC §75). Completion in month M
 *  leaves (6 - M + 12) % 12 months: e.g. October -> 8, July -> 11,
 *  June -> 0. */
export function supplementalMonths(completionMonth: number): number {
  if (!Number.isInteger(completionMonth) || completionMonth < 1 || completionMonth > 12) return 0;
  return (6 - completionMonth + 12) % 12;
}

/** First-year supplemental assessment (R&TC §75): the annual tax prorated
 *  over the months remaining in the fiscal year after completion. */
export function supplementalTax(annual: number, completionMonth: number): number {
  const months = supplementalMonths(completionMonth);
  if (months === 0 || annual <= 0) return 0;
  return Math.round((annual * months) / 12);
}

export function findCounty(data: PropertyTaxData, county: string): CountyRate | null {
  return data.counties.find(c => c.county === county) ?? null;
}

export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(ratePct: number): string {
  // Keep at least 3 decimals (BOE averages are 3-decimal), trim the rest.
  const s = ratePct.toFixed(5).replace(/(\.\d{3,}?)0+$/, "$1");
  return `${s}%`;
}
