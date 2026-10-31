// Pure fee-calculation logic for the ADU fee calculator.
// Shared by FeeCalculator.astro (server-rendered default view) and its
// client-side script, so both render identical results from fees.json.
//
// Calculation methods supported:
//   flat            -> rate_low (fixed $); rate_high present => range
//   per_sqft        -> rate * sqft
//   pct_valuation   -> rate * (valuation_psf * sqft)
//   valuation_step  -> base + rate * (valuation - threshold) / step
// Anything else (or missing rate data) is SKIPPED, never guessed:
// the row renders as "—" with a reason, is excluded from the total,
// and a console warning is emitted.
//
// State-law exemptions (rules in fees.json):
//   impact category, sqft <= impact_exempt_max_sqft  -> $0
//   school category, sqft <  school_exempt_below_sqft -> $0

export interface FeeRules {
  impact_exempt_max_sqft: number;
  school_exempt_below_sqft: number;
  citation: string;
}

export interface Jurisdiction {
  juris_id: string;
  name: string;
  county: string;
  region: string;
  post_slug: string;
  valuation_psf: number | null;
  valuation_basis: string | null;
  fee_schedule_url: string;
  last_verified: string;
  status: "verified" | "to_verify" | "conflict" | "illustrative" | string;
}

export interface FeeItem {
  item_id: string;
  juris_id: string;
  category: string;
  fee_name: string;
  method: string;
  rate_low: number | null;
  rate_high: number | null;
  base: number | null;
  threshold: number | null;
  step: number | null;
  min_sqft: number | null;
  max_sqft: number | null;
  applies_to: string;
  source_url: string | null;
  source_note: string | null;
  effective_date: string | null;
  last_verified: string | null;
  confidence: string;
  status: string;
  notes: string | null;
  /**
   * True when rate_low is a per-dwelling base, not an ADU fee: the city
   * publishes a dwelling-unit fee and ADUs pay (ADU sq ft / primary sq ft)
   * of it under Gov. Code §66311.5(c)(1)(B). Only flagged lines prorate;
   * a city-adopted ADU flat fee displays as-is.
   */
  dwelling_base?: boolean | null;
  /** Optional cap on the prorated result (e.g. Westminster $4,000). */
  cap?: number | null;
  /**
   * Mutually exclusive area schedule within the jurisdiction (e.g.
   * Ontario "General City" vs "Ontario Ranch"). Null = applies to all
   * areas. A parcel pays one area's rows, never the sum of all areas.
   */
  area?: string | null;
}

export interface FeeData {
  generated: string;
  rules: FeeRules;
  jurisdictions: Jurisdiction[];
  fee_items: FeeItem[];
}

export type LineKind = "ok" | "exempt" | "skipped" | "out_of_scope";

export interface CalcLine {
  item: FeeItem;
  kind: LineKind;
  /** Human-readable note for exempt / skipped lines. */
  reason: string | null;
  low: number;
  /** null => single value (no range). */
  high: number | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  plan_check_permit: "Plan check & permits",
  impact: "Impact fees",
  planning: "Planning fees",
  school: "School fees",
  construction_tax: "Construction taxes",
  utility_capacity: "Utility & capacity",
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

const KNOWN_METHODS = new Set([
  "flat",
  "per_sqft",
  "pct_valuation",
  "valuation_step",
]);

function warn(msg: string): void {
  if (typeof console !== "undefined") {
    console.warn(`[fee-calculator] ${msg}`);
  }
}

/**
 * Default primary-dwelling size for static displays and the calculator.
 * This is an ASSUMPTION, not a verified figure — every surface that uses
 * it must label it as such. The calculator lets the user enter their
 * actual primary size.
 */
export const DEFAULT_PRIMARY_SQFT = 1600;

export interface CalcOpts {
  primarySqft?: number;
  /**
   * Area schedule for jurisdictions with mutually exclusive areas
   * (Ontario). Null/undefined resolves to the alphabetically first area,
   * so exclusive areas are never summed by default.
   */
  area?: string | null;
  /** When true, only status === "verified" items are included. */
  verifiedOnly?: boolean;
}

/** Distinct non-null area schedules for a jurisdiction, sorted. */
export function jurisAreas(data: FeeData, jurisId: string): string[] {
  const areas = new Set<string>();
  for (const i of data.fee_items) {
    if (i.juris_id === jurisId && i.area != null && i.area !== "") {
      areas.add(i.area);
    }
  }
  return [...areas].sort((a, b) => a.localeCompare(b, "en-US"));
}

function resolveArea(
  data: FeeData,
  jurisId: string,
  areaOpt: string | null | undefined
): string | null {
  if (areaOpt != null) return areaOpt;
  const areas = jurisAreas(data, jurisId);
  return areas.length > 0 ? areas[0] : null;
}

function clampPrimary(primarySqft: number | undefined): number {
  const n = Math.round(primarySqft ?? DEFAULT_PRIMARY_SQFT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRIMARY_SQFT;
}

export function calcLine(
  item: FeeItem,
  juris: Jurisdiction,
  sqft: number,
  rules: FeeRules,
  primarySqft: number = DEFAULT_PRIMARY_SQFT
): CalcLine {
  // 1. Size-tier scope
  if (item.min_sqft != null && sqft < item.min_sqft) {
    return { item, kind: "out_of_scope", reason: null, low: 0, high: null };
  }
  if (item.max_sqft != null && sqft > item.max_sqft) {
    return { item, kind: "out_of_scope", reason: null, low: 0, high: null };
  }
  if (item.applies_to !== "all") {
    warn(`${item.item_id}: unsupported applies_to="${item.applies_to}" — skipped`);
    return {
      item,
      kind: "skipped",
      reason: `Applies-to "${item.applies_to}" is not supported yet.`,
      low: 0,
      high: null,
    };
  }

  // 2. State-law exemptions — these zero the line but it stays visible.
  if (item.category === "impact" && sqft <= rules.impact_exempt_max_sqft) {
    return {
      item,
      kind: "exempt",
      reason: `State law bars impact fees on ADUs of ${rules.impact_exempt_max_sqft} sq ft or less (${rules.citation}).`,
      low: 0,
      high: null,
    };
  }
  if (item.category === "school" && sqft < rules.school_exempt_below_sqft) {
    return {
      item,
      kind: "exempt",
      reason: `No school developer fee below ${rules.school_exempt_below_sqft} sq ft.`,
      low: 0,
      high: null,
    };
  }

  // 3. Method dispatch
  if (!KNOWN_METHODS.has(item.method)) {
    warn(`${item.item_id}: unknown method "${item.method}" — skipped`);
    return {
      item,
      kind: "skipped",
      reason: `Calculation method "${item.method}" is not supported yet.`,
      low: 0,
      high: null,
    };
  }

  const valuation =
    juris.valuation_psf != null ? juris.valuation_psf * sqft : null;

  switch (item.method) {
    case "flat": {
      if (item.rate_low == null) {
        warn(`${item.item_id}: flat method with no rate — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "No rate on file — the published post does not break out a value for this size.",
          low: 0,
          high: null,
        };
      }
      // Dwelling-base lines prorate: (ADU sq ft / primary sq ft) × base.
      // The ≤750 exemption above already zeroed smaller ADUs. A cap
      // (e.g. Westminster) applies to the prorated result, not the base.
      let low = item.rate_low;
      let high = item.rate_high;
      if (item.dwelling_base) {
        low = (sqft / primarySqft) * item.rate_low;
        high =
          item.rate_high != null
            ? (sqft / primarySqft) * item.rate_high
            : null;
      }
      if (item.cap != null) {
        low = Math.min(low, item.cap);
        if (high != null) high = Math.min(high, item.cap);
      }
      return {
        item,
        kind: "ok",
        reason: null,
        low: Math.round(low),
        high: high != null ? Math.round(high) : null,
      };
    }
    case "per_sqft": {
      if (item.rate_low == null) {
        warn(`${item.item_id}: per_sqft with no rate — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "No per-sq-ft rate on file.",
          low: 0,
          high: null,
        };
      }
      return {
        item,
        kind: "ok",
        reason: null,
        low: Math.round(item.rate_low * sqft),
        high:
          item.rate_high != null
            ? Math.round(item.rate_high * sqft)
            : null,
      };
    }
    case "pct_valuation": {
      if (valuation == null) {
        warn(`${item.item_id}: pct_valuation but jurisdiction has no valuation_psf — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "No valuation basis on file for this jurisdiction.",
          low: 0,
          high: null,
        };
      }
      if (item.rate_low == null) {
        warn(`${item.item_id}: pct_valuation with no rate — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "No percentage rate on file.",
          low: 0,
          high: null,
        };
      }
      return {
        item,
        kind: "ok",
        reason: null,
        low: Math.round(item.rate_low * valuation),
        high:
          item.rate_high != null
            ? Math.round(item.rate_high * valuation)
            : null,
      };
    }
    case "valuation_step": {
      if (valuation == null) {
        warn(`${item.item_id}: valuation_step but jurisdiction has no valuation_psf — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "No valuation basis on file for this jurisdiction.",
          low: 0,
          high: null,
        };
      }
      if (
        item.base == null ||
        item.threshold == null ||
        item.step == null ||
        item.rate_low == null
      ) {
        warn(`${item.item_id}: valuation_step missing base/threshold/step/rate — skipped`);
        return {
          item,
          kind: "skipped",
          reason: "Incomplete step-schedule data on file.",
          low: 0,
          high: null,
        };
      }
      if (valuation < item.threshold) {
        warn(
          `${item.item_id}: valuation $${Math.round(valuation).toLocaleString("en-US")} below schedule threshold $${item.threshold.toLocaleString("en-US")} — skipped (no data for this segment)`
        );
        return {
          item,
          kind: "skipped",
          reason:
            "The fee schedule segment on file starts at a higher valuation — no data for this size.",
          low: 0,
          high: null,
        };
      }
      const steps = (valuation - item.threshold) / item.step;
      return {
        item,
        kind: "ok",
        reason: null,
        low: Math.round(item.base + item.rate_low * steps),
        high:
          item.rate_high != null
            ? Math.round(item.base + item.rate_high * steps)
            : null,
      };
    }
    default: {
      warn(`${item.item_id}: unhandled method "${item.method}" — skipped`);
      return {
        item,
        kind: "skipped",
        reason: "Unsupported calculation method.",
        low: 0,
        high: null,
      };
    }
  }
}

export interface CalcResult {
  juris: Jurisdiction;
  sqft: number;
  /** Primary-dwelling size the proration used (assumption unless the user set it). */
  primarySqft: number;
  /** Resolved area schedule, or null for jurisdictions without areas. */
  area: string | null;
  /** In-scope lines only (ok + exempt + skipped). */
  lines: CalcLine[];
  totalLow: number;
  /** null => single total (no range). */
  totalHigh: number | null;
  hasRange: boolean;
  skippedCount: number;
  impactLow: number;
  impactHigh: number | null;
}

export function calcJurisdiction(
  data: FeeData,
  jurisId: string,
  sqft: number,
  opts: CalcOpts = {}
): CalcResult {
  const juris = data.jurisdictions.find(j => j.juris_id === jurisId);
  if (!juris) {
    throw new Error(`[fee-calculator] unknown jurisdiction "${jurisId}"`);
  }
  const primarySqft = clampPrimary(opts.primarySqft);
  const area = resolveArea(data, jurisId, opts.area);
  const lines = data.fee_items
    .filter(i => i.juris_id === jurisId)
    .filter(i => area == null || i.area == null || i.area === area)
    .filter(i => !opts.verifiedOnly || i.status === "verified")
    .map(item => calcLine(item, juris, sqft, data.rules, primarySqft))
    .filter(l => l.kind !== "out_of_scope");

  let totalLow = 0;
  let totalHigh = 0;
  let hasRange = false;
  let skippedCount = 0;
  let impactLow = 0;
  let impactHigh = 0;
  let impactHasRange = false;

  for (const l of lines) {
    if (l.kind === "skipped") {
      skippedCount++;
      continue;
    }
    totalLow += l.low;
    if (l.high != null) {
      totalHigh += l.high;
      hasRange = true;
    } else {
      totalHigh += l.low;
    }
    if (l.item.category === "impact") {
      impactLow += l.low;
      if (l.high != null) {
        impactHigh += l.high;
        impactHasRange = true;
      } else {
        impactHigh += l.low;
      }
    }
  }

  return {
    juris,
    sqft,
    primarySqft,
    area,
    lines,
    totalLow,
    totalHigh: hasRange ? totalHigh : null,
    hasRange,
    skippedCount,
    impactLow,
    impactHigh: impactHasRange ? impactHigh : null,
  };
}

// ---------------------------------------------------------------------------
// SB 1117 comparison (effective Jan 1, 2027): for a homeowner's first two
// ADUs, impact fees apply only to the square footage above 750. Per-sq-ft
// lines scale to (sqft - 750); dwelling-base flat lines convert to
// ((sqft - 750) / primary) × base once the primary size is known. Other
// flat lines cannot be converted until cities publish how flat fees map
// to the excess-area rule, so they are reported as uncertain and never
// guessed.
// ---------------------------------------------------------------------------

export interface SB1117Line {
  item: FeeItem;
  currentLow: number;
  currentHigh: number | null;
  /** null => conversion not published for this line. */
  futureLow: number | null;
  futureHigh: number | null;
  uncertain: boolean;
}

export interface SB1117Result {
  sqft: number;
  excess: number;
  lines: SB1117Line[];
  /** Current-law impact total (ok lines only). */
  currentLow: number;
  currentHigh: number | null;
  /** 2027 impact total over convertible lines only. */
  futureLow: number;
  futureHigh: number | null;
  /** Savings over convertible lines only. */
  savingsLow: number;
  savingsHigh: number | null;
  /** Current-law total of lines that cannot be converted yet. */
  uncertainLow: number;
  uncertainHigh: number | null;
  hasImpactLines: boolean;
}

export function calcSB1117(
  data: FeeData,
  jurisId: string,
  sqft: number,
  opts: CalcOpts = {}
): SB1117Result {
  const juris = data.jurisdictions.find(j => j.juris_id === jurisId);
  if (!juris) {
    throw new Error(`[fee-calculator] unknown jurisdiction "${jurisId}"`);
  }
  const primarySqft = clampPrimary(opts.primarySqft);
  const area = resolveArea(data, jurisId, opts.area);
  const excess = Math.max(0, sqft - data.rules.impact_exempt_max_sqft);
  const lines: SB1117Line[] = [];
  for (const item of data.fee_items.filter(
    i => i.juris_id === jurisId && i.category === "impact"
  )) {
    if (area != null && item.area != null && item.area !== area) continue;
    if (opts.verifiedOnly && item.status !== "verified") continue;
    const line = calcLine(item, juris, sqft, data.rules, primarySqft);
    if (line.kind === "out_of_scope" || line.kind === "skipped") continue;
    if (line.kind === "exempt") {
      lines.push({
        item,
        currentLow: 0,
        currentHigh: null,
        futureLow: 0,
        futureHigh: null,
        uncertain: false,
      });
      continue;
    }
    if (item.method === "per_sqft" && item.rate_low != null) {
      lines.push({
        item,
        currentLow: line.low,
        currentHigh: line.high,
        futureLow: Math.round(item.rate_low * excess),
        futureHigh:
          item.rate_high != null
            ? Math.round(item.rate_high * excess)
            : null,
        uncertain: false,
      });
    } else if (item.dwelling_base && item.method === "flat" && item.rate_low != null) {
      // Dwelling-base lines convert exactly once the primary size is
      // known: ((sqft − 750) / primary) × base. Caps still apply.
      let futureLow = (excess / primarySqft) * item.rate_low;
      let futureHigh =
        item.rate_high != null
          ? (excess / primarySqft) * item.rate_high
          : null;
      if (item.cap != null) {
        futureLow = Math.min(futureLow, item.cap);
        if (futureHigh != null) futureHigh = Math.min(futureHigh, item.cap);
      }
      lines.push({
        item,
        currentLow: line.low,
        currentHigh: line.high,
        futureLow: Math.round(futureLow),
        futureHigh: futureHigh != null ? Math.round(futureHigh) : null,
        uncertain: false,
      });
    } else {
      lines.push({
        item,
        currentLow: line.low,
        currentHigh: line.high,
        futureLow: null,
        futureHigh: null,
        uncertain: true,
      });
    }
  }

  let currentLow = 0;
  let currentHigh = 0;
  let currentHasRange = false;
  let futureLow = 0;
  let futureHigh = 0;
  let futureHasRange = false;
  let savingsLow = 0;
  let savingsHigh = 0;
  let savingsHasRange = false;
  let uncertainLow = 0;
  let uncertainHigh = 0;
  let uncertainHasRange = false;
  for (const l of lines) {
    currentLow += l.currentLow;
    if (l.currentHigh != null) {
      currentHigh += l.currentHigh;
      currentHasRange = true;
    } else {
      currentHigh += l.currentLow;
    }
    if (l.uncertain) {
      uncertainLow += l.currentLow;
      if (l.currentHigh != null) {
        uncertainHigh += l.currentHigh;
        uncertainHasRange = true;
      } else {
        uncertainHigh += l.currentLow;
      }
    } else {
      const fl = l.futureLow ?? 0;
      futureLow += fl;
      if (l.futureHigh != null) {
        futureHigh += l.futureHigh;
        futureHasRange = true;
      } else {
        futureHigh += fl;
      }
      savingsLow += l.currentLow - fl;
      const ch = l.currentHigh ?? l.currentLow;
      const fh = l.futureHigh ?? fl;
      savingsHigh += ch - fh;
      if (l.currentHigh != null || l.futureHigh != null) {
        savingsHasRange = true;
      }
    }
  }

  return {
    sqft,
    excess,
    lines,
    currentLow,
    currentHigh: currentHasRange ? currentHigh : null,
    futureLow,
    futureHigh: futureHasRange ? futureHigh : null,
    savingsLow,
    savingsHigh: savingsHasRange ? savingsHigh : null,
    uncertainLow,
    uncertainHigh: uncertainHasRange ? uncertainHigh : null,
    hasImpactLines: lines.length > 0,
  };
}

function sb1117BlockHTML(data: FeeData, jurisId: string, sqft: number, opts: CalcOpts = {}): string {
  const sb = calcSB1117(data, jurisId, sqft, opts);
  const wrap = (inner: string) =>
    `<div class="mt-3 rounded-md border border-teal-600/40 bg-teal-50 p-4 dark:bg-teal-950/30">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">Coming Jan 1, 2027 · SB 1117 — permit now vs permit after Jan 1</div>
      ${inner}
    </div>`;
  if (!sb.hasImpactLines) {
    return wrap(
      `<p class="mt-1 text-sm">No impact-fee line items are on file for this jurisdiction yet, so SB 1117 changes nothing here.</p>`
    );
  }
  if (sqft <= data.rules.impact_exempt_max_sqft) {
    return wrap(
      `<p class="mt-1 text-sm">At ${sqft.toLocaleString("en-US")} sq ft, impact fees are $0 under both rules — SB 1117 changes nothing at this size. The change only matters above 750 sq ft.</p>`
    );
  }
  const headline =
    sb.savingsLow > 0
      ? `Waiting until January could save about <strong>${fmtRange(sb.savingsLow, sb.savingsHigh)}</strong> on impact fees.`
      : sb.uncertainLow > 0
        ? `Computed savings are $0 — but <strong>${fmtRange(sb.uncertainLow, sb.uncertainHigh)}</strong> in flat impact fees cannot be converted yet, so the real savings could be higher.`
        : `No change — this jurisdiction's impact fees do not move under SB 1117 at this size.`;
  const rows = sb.lines
    .map(l => {
      const futureCell = l.uncertain
        ? `<span class="text-foreground/60">Conversion not published yet</span>`
        : `<span class="font-medium">${fmtRange(l.futureLow ?? 0, l.futureHigh)}</span>`;
      return `<tr class="border-border border-b align-top">
        <td class="py-2 pe-3"><div class="font-medium">${esc(l.item.fee_name)}${itemBadgeHTML(l.item.status)}</div></td>
        <td class="py-2 pe-3 text-right tabular-nums whitespace-nowrap">${fmtRange(l.currentLow, l.currentHigh)}</td>
        <td class="py-2 text-right tabular-nums whitespace-nowrap">${futureCell}</td>
      </tr>`;
    })
    .join("");
  const uncertainNote =
    sb.uncertainLow > 0
      ? `<p class="text-foreground/70 mt-2 text-xs">Flat impact fees of ${fmtRange(sb.uncertainLow, sb.uncertainHigh)} are not converted above: cities have not published how flat fees map to the excess-area rule, so we do not guess them.</p>`
      : "";
  return wrap(`
    <div class="mt-2 grid gap-3 sm:grid-cols-3">
      <div><div class="text-foreground/70 text-xs uppercase">2026 impact fees</div><div class="text-xl font-semibold tabular-nums">${fmtRange(sb.currentLow, sb.currentHigh)}</div></div>
      <div><div class="text-foreground/70 text-xs uppercase">2027 impact fees (convertible lines)</div><div class="text-xl font-semibold tabular-nums">${fmtRange(sb.futureLow, sb.futureHigh)}</div></div>
      <div><div class="text-foreground/70 text-xs uppercase">You could save</div><div class="text-xl font-semibold tabular-nums">${fmtRange(sb.savingsLow, sb.savingsHigh)}</div></div>
    </div>
    <p class="mt-2 text-sm font-medium">${headline}</p>
    <div class="relative mt-3 w-full overflow-x-auto">
      <table class="w-full min-w-[28rem] border-collapse text-sm">
        <thead><tr class="border-border border-b text-left">
          <th class="py-2 pe-3 font-semibold">Impact fee</th>
          <th class="py-2 pe-3 text-right font-semibold">2026</th>
          <th class="py-2 text-right font-semibold">2027</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${uncertainNote}
    <p class="text-foreground/70 mt-2 text-xs">Only impact fees change. School fees, permit fees, and utility/capacity charges are unchanged, and SB 1117 covers a homeowner's first two ADUs. Waiting has its own costs — schedule changes, delay, financing — so this is a fee comparison, not advice to wait.</p>`);
}

// ---------------------------------------------------------------------------
// Formatting + HTML rendering (shared by SSR and client)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}

export function fmtUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtRange(low: number, high: number | null): string {
  if (high != null && high !== low) {
    return `${fmtUSD(low)}–${fmtUSD(high)}`;
  }
  return fmtUSD(low);
}

export function jurisBadgeHTML(status: string): string {
  const base =
    "ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-xs font-medium";
  switch (status) {
    case "to_verify":
      return `<span class="${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Verifying</span>`;
    case "conflict":
      return `<span class="${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">Figures under review</span>`;
    case "illustrative":
      return `<span class="${base} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">Illustrative</span>`;
    default:
      return "";
  }
}

function itemBadgeHTML(status: string): string {
  if (status === "to_verify" || status === "conflict") {
    return `<span class="ml-1 inline-block rounded-full bg-amber-100 px-1.5 py-px align-middle text-[0.65rem] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">verifying</span>`;
  }
  return "";
}

function sourceCellHTML(item: FeeItem): string {
  if (item.source_url) {
    const label = item.source_note ? esc(item.source_note) : "Source";
    return `<a href="${esc(item.source_url)}" target="_blank" rel="noopener" class="text-accent underline decoration-dashed underline-offset-4">${label} ↗</a>`;
  }
  return `<span class="text-foreground/50">No source listed</span>`;
}

function amountCellHTML(line: CalcLine): string {
  if (line.kind === "skipped") {
    return `<span class="text-foreground/50" title="${esc(line.reason ?? "")}">—</span>`;
  }
  if (line.kind === "exempt") {
    return `<span class="text-green-700 dark:text-green-400">$0 <span class="text-xs font-normal">exempt</span></span>`;
  }
  return `<span class="font-medium">${fmtRange(line.low, line.high)}</span>`;
}

/**
 * Full results block (total cards + cliff callout + breakdown table +
 * notes + disclaimer) for one jurisdiction + size. Used for the
 * server-rendered default and re-rendered by the client on every input.
 */
export function resultsHTML(
  data: FeeData,
  jurisId: string,
  sqft: number,
  opts: CalcOpts = {}
): string {
  const r = calcJurisdiction(data, jurisId, sqft, opts);
  const at750 = calcJurisdiction(data, jurisId, data.rules.impact_exempt_max_sqft, opts);
  const at751 = calcJurisdiction(data, jurisId, data.rules.impact_exempt_max_sqft + 1, opts);

  const badge = jurisBadgeHTML(r.juris.status);
  const totalText = fmtRange(r.totalLow, r.totalHigh);
  const impactText = fmtRange(r.impactLow, r.impactHigh);
  const areaLabel = r.area != null ? ` · ${esc(r.area)} area` : "";
  const hasDwellingBase = r.lines.some(
    l => l.item.dwelling_base && l.kind === "ok"
  );
  const primaryNote = hasDwellingBase
    ? `<div class="text-foreground/60 mt-2 text-xs">Dwelling-base impact fees prorated at a ${r.primarySqft.toLocaleString("en-US")} sq ft primary dwelling — an assumption, not a verified figure. Enter your actual primary size above to re-price them.</div>`
    : "";

  const deltaLow = at751.totalLow - at750.totalLow;
  const deltaHigh =
    at751.totalHigh != null && at750.totalHigh != null
      ? at751.totalHigh - at750.totalHigh
      : null;
  const hasImpactItems = r.lines.some(
    l => l.item.category === "impact" && l.kind !== "skipped"
  );

  // Category breakdown of the 750→751 total jump, from the same two
  // calculations the card already shows. A line out of scope at one size
  // counts as $0 there, so tier swaps (e.g. permit tiers) net correctly.
  // The breakdown sums to the displayed low-end jump (deltaLow); when the
  // 751 side has ranged lines, the high end of the jump is larger.
  const deltaByCat = new Map<string, number>();
  for (const id of new Set([
    ...at750.lines.map(l => l.item.item_id),
    ...at751.lines.map(l => l.item.item_id),
  ])) {
    const l750 = at750.lines.find(l => l.item.item_id === id);
    const l751 = at751.lines.find(l => l.item.item_id === id);
    const d = (l751?.low ?? 0) - (l750?.low ?? 0);
    if (d !== 0) {
      const cat = (l751 ?? l750)!.item.category;
      deltaByCat.set(cat, (deltaByCat.get(cat) ?? 0) + d);
    }
  }
  const jumpBreakdown = [...deltaByCat.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(
      ([cat, d]) =>
        `${categoryLabel(cat)} ${d >= 0 ? "+" : "-"}$${Math.abs(d).toLocaleString("en-US")}`
    )
    .join(", ");
  const jumpNote =
    jumpBreakdown !== ""
      ? ` Jump breakdown${deltaHigh != null ? " (low end)" : ""}: ${jumpBreakdown}.`
      : "";

  const cliffText = hasImpactItems
    ? `At ${data.rules.impact_exempt_max_sqft} sq ft, this jurisdiction's impact fees are <strong>${fmtRange(at750.impactLow, at750.impactHigh)}</strong> — state law bars them. At ${data.rules.impact_exempt_max_sqft + 1} sq ft they become <strong>${fmtRange(at751.impactLow, at751.impactHigh)}</strong>, and the fee total jumps by about <strong>${fmtRange(deltaLow, deltaHigh)}</strong>. Drag the slider across 750 to watch it happen.${jumpNote}`
    : `No impact-fee line items are on file for this jurisdiction yet, so the 750 sq ft cliff does not move its total.`;

  const rows = r.lines
    .map(l => {
      const note = l.reason
        ? `<div class="text-foreground/60 mt-1 text-xs">${esc(l.reason)}</div>`
        : "";
      const srcNote =
        l.item.notes && l.kind !== "skipped"
          ? `<div class="text-foreground/60 mt-1 text-xs">${esc(l.item.notes)}</div>`
          : "";
      return `<tr class="border-border border-b align-top">
        <td class="py-2 pe-3">
          <div class="font-medium">${esc(l.item.fee_name)}${itemBadgeHTML(l.item.status)}</div>
          <div class="text-foreground/60 text-xs">${esc(categoryLabel(l.item.category))}</div>
          ${note}${srcNote}
        </td>
        <td class="py-2 pe-3 text-right tabular-nums whitespace-nowrap">${amountCellHTML(l)}</td>
        <td class="py-2 text-sm">${sourceCellHTML(l.item)}</td>
      </tr>`;
    })
    .join("");

  const skippedNote =
    r.skippedCount > 0
      ? `<p class="text-foreground/70 mt-3 text-xs">${r.skippedCount} line item${r.skippedCount > 1 ? "s are" : " is"} excluded from the total — the fee schedule data on file does not cover ${r.skippedCount > 1 ? "them" : "it"} (marked “—” above). We do not guess missing rates.</p>`
      : "";

  return `
  <div class="grid gap-3 sm:grid-cols-2">
    <div class="border-border rounded-md border p-4">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">Estimated fees · ${esc(r.juris.name)}${badge}</div>
      <div class="mt-1 text-3xl font-semibold tabular-nums">${totalText}</div>
      <div class="text-foreground/80 mt-1 text-sm">at ${sqft.toLocaleString("en-US")} sq ft${areaLabel} · impact fees ${impactText}</div>
      <div class="text-foreground/60 mt-2 text-xs">Checked ${esc(r.juris.last_verified)} · <a href="${esc(r.juris.fee_schedule_url)}" target="_blank" rel="noopener" class="text-accent underline decoration-dashed underline-offset-4">fee schedule ↗</a></div>
      ${primaryNote}
    </div>
    <div class="rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">The 750 sq ft cliff</div>
      <p class="mt-1 text-sm">${cliffText}</p>
    </div>
  </div>
  ${sb1117BlockHTML(data, jurisId, sqft, opts)}
  <div class="relative mt-6 w-full overflow-x-auto">
    <table class="w-full min-w-[40rem] border-collapse text-sm">
      <thead>
        <tr class="border-border border-b text-left">
          <th class="py-2 pe-3 font-semibold">Fee item</th>
          <th class="py-2 pe-3 text-right font-semibold">Amount</th>
          <th class="py-2 font-semibold">Source</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${skippedNote}
  <p class="border-border mt-4 border-t pt-4 text-sm font-medium">This calculator applies published fee schedules — it is not a construction quote. Totals cover government fees only: no design, construction, financing, or contingency costs.</p>
  ${r.juris.post_slug ? `<p class="text-foreground/70 mt-2 text-xs">Full breakdown with methodology notes: <a href="/posts/${esc(r.juris.post_slug)}/" class="text-accent underline decoration-dashed underline-offset-4">Read the ${esc(r.juris.name)} post →</a></p>` : ""}`;
}

export interface CategoryTotal {
  category: string;
  /** Sum of ok + exempt lines only; skipped lines are excluded, like the total. */
  low: number;
  high: number | null;
  hasRange: boolean;
}

/**
 * Per-category totals for one calcJurisdiction result, in
 * CATEGORY_LABELS order (unknown categories last, alphabetical).
 * Sums to totalLow / totalHigh when ranges are folded the same way.
 */
export function categoryTotals(r: CalcResult): CategoryTotal[] {
  const byCat = new Map<string, { low: number; high: number; hasRange: boolean }>();
  for (const l of r.lines) {
    if (l.kind === "skipped") continue;
    const cur = byCat.get(l.item.category) ?? { low: 0, high: 0, hasRange: false };
    cur.low += l.low;
    if (l.high != null) {
      cur.high += l.high;
      cur.hasRange = true;
    } else {
      cur.high += l.low;
    }
    byCat.set(l.item.category, cur);
  }
  const knownOrder = Object.keys(CATEGORY_LABELS);
  return [...byCat.entries()]
    .sort(([a], [b]) => {
      const ia = knownOrder.indexOf(a);
      const ib = knownOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, "en-US");
    })
    .map(([category, v]) => ({
      category,
      low: v.low,
      high: v.hasRange ? v.high : null,
      hasRange: v.hasRange,
    }));
}

export interface SideInput {
  jurisId: string;
  sqft: number;
  area?: string | null;
}

function moneyDiffSigned(n: number): string {
  if (n === 0) return "$0";
  return (n > 0 ? "+" : "−") + fmtUSD(Math.abs(n));
}

/**
 * Side-by-side fee comparison for two jurisdictions at (possibly) two
 * sizes. Shared by JurisdictionCompare.astro (SSR default) and its client
 * script, so both render identical results.
 *
 * Comparison unit is the category total (ok + exempt lines; skipped lines
 * excluded, exactly like each side's total). Individual fee lines differ
 * by city, so line-by-line comparison would be false precision.
 * Differences use low ends; a footnote says so when either side ranges.
 */
export function sideBySideHTML(
  data: FeeData,
  a: SideInput,
  b: SideInput,
  primarySqft: number = DEFAULT_PRIMARY_SQFT
): string {
  const resA = calcJurisdiction(data, a.jurisId, a.sqft, {
    primarySqft,
    area: a.area ?? null,
  });
  const resB = calcJurisdiction(data, b.jurisId, b.sqft, {
    primarySqft,
    area: b.area ?? null,
  });
  const catsA = categoryTotals(resA);
  const catsB = categoryTotals(resB);
  const catOrder = Object.keys(CATEGORY_LABELS);
  const unionCats = [...new Set([...catsA.map(c => c.category), ...catsB.map(c => c.category)])].sort(
    (x, y) => {
      const ix = catOrder.indexOf(x);
      const iy = catOrder.indexOf(y);
      if (ix !== -1 && iy !== -1) return ix - iy;
      if (ix !== -1) return -1;
      if (iy !== -1) return 1;
      return x.localeCompare(y, "en-US");
    }
  );
  const catVal = (cats: ReturnType<typeof categoryTotals>, cat: string) =>
    cats.find(c => c.category === cat);

  const diffLow = resB.totalLow - resA.totalLow;
  const ranged = resA.hasRange || resB.hasRange;
  const pct =
    resA.totalLow > 0
      ? `${diffLow >= 0 ? "+" : "−"}${Math.abs(Math.round((diffLow / resA.totalLow) * 100))}%`
      : "—";
  const diffClass =
    diffLow > 0
      ? "text-accent"
      : diffLow < 0
        ? "text-green-600 dark:text-green-400"
        : "";
  const psfA = Math.round(resA.totalLow / a.sqft);
  const psfB = Math.round(resB.totalLow / b.sqft);

  const barRow = (label: string, aLow: number, bLow: number, aText: string, bText: string, big: boolean) => {
    const max = Math.max(aLow, bLow, 1);
    const wa = Math.round((aLow / max) * 100);
    const wb = Math.round((bLow / max) * 100);
    return `<div>
      <div class="flex items-baseline justify-between gap-2 text-sm">
        <span class="${big ? "font-semibold" : "font-medium"}">${label}</span>
        <span class="text-foreground/70 text-xs tabular-nums">A ${aText} · B ${bText}</span>
      </div>
      <div class="mt-1 space-y-1">
        <div class="flex items-center gap-2">
          <span class="w-3 text-xs font-medium" aria-hidden="true">A</span>
          <div class="${big ? "h-4" : "h-3"} rounded bg-accent" style="width: ${wa}%"></div>
          <span class="text-xs tabular-nums">${aText}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 text-xs font-medium" aria-hidden="true">B</span>
          <div class="${big ? "h-4" : "h-3"} rounded bg-teal-600 dark:bg-teal-500" style="width: ${wb}%"></div>
          <span class="text-xs tabular-nums">${bText}</span>
        </div>
      </div>
    </div>`;
  };

  const chartRows = [
    barRow(
      "Total fees",
      resA.totalLow,
      resB.totalLow,
      fmtRange(resA.totalLow, resA.totalHigh),
      fmtRange(resB.totalLow, resB.totalHigh),
      true
    ),
    ...unionCats.map(cat => {
      const ca = catVal(catsA, cat);
      const cb = catVal(catsB, cat);
      return barRow(
        categoryLabel(cat),
        ca?.low ?? 0,
        cb?.low ?? 0,
        fmtRange(ca?.low ?? 0, ca?.high ?? null),
        fmtRange(cb?.low ?? 0, cb?.high ?? null),
        false
      );
    }),
  ].join(`<div class="border-border my-3 border-t"></div>`);

  const tableRows = unionCats
    .map(cat => {
      const ca = catVal(catsA, cat);
      const cb = catVal(catsB, cat);
      const av = ca?.low ?? 0;
      const bv = cb?.low ?? 0;
      const d = bv - av;
      return `<tr class="border-border border-b">
        <td class="py-2 pe-3">${esc(categoryLabel(cat))}</td>
        <td class="py-2 pe-3 text-right tabular-nums whitespace-nowrap">${fmtRange(av, ca?.high ?? null)}</td>
        <td class="py-2 pe-3 text-right tabular-nums whitespace-nowrap">${fmtRange(bv, cb?.high ?? null)}</td>
        <td class="py-2 text-right tabular-nums whitespace-nowrap ${d > 0 ? "text-accent" : d < 0 ? "text-green-600 dark:text-green-400" : ""}">${moneyDiffSigned(d)}</td>
      </tr>`;
    })
    .join("");

  const notes: string[] = [];
  for (const [tag, r] of [["A", resA], ["B", resB]] as const) {
    if (r.lines.length === 0) {
      notes.push(
        `${tag} (${esc(r.juris.name)}): no fee items are on file yet, so its total is $0 — that is missing data, not a free permit.`
      );
    } else if (r.skippedCount > 0) {
      notes.push(
        `${tag} (${esc(r.juris.name)}): ${r.skippedCount} line item${r.skippedCount > 1 ? "s are" : " is"} excluded from the total — the schedule data on file does not cover ${r.skippedCount > 1 ? "them" : "it"}. We do not guess missing rates.`
      );
    }
  }
  const cliff = data.rules.impact_exempt_max_sqft;
  if ((a.sqft <= cliff) !== (b.sqft <= cliff)) {
    notes.push(
      `The two sizes straddle the ${cliff} sq ft cliff: the smaller side's impact fees are $0 by state law (${data.rules.citation}) while the larger side pays them. That gap is law, not price.`
    );
  }
  const hasDwellingBase =
    resA.lines.some(l => l.item.dwelling_base && l.kind === "ok") ||
    resB.lines.some(l => l.item.dwelling_base && l.kind === "ok");
  if (hasDwellingBase) {
    notes.push(
      `Dwelling-base impact fees are prorated at a ${primarySqft.toLocaleString("en-US")} sq ft primary dwelling — an assumption, not a verified figure. Enter your actual primary size above to re-price them.`
    );
  }
  if (ranged) {
    notes.push(
      `Differences use low ends. Either side has ranged lines, so the high-end gap is larger than the difference shown.`
    );
  }
  const notesHTML =
    notes.length > 0
      ? `<ul class="text-foreground/70 mt-3 list-disc space-y-1 ps-5 text-xs">${notes.map(n => `<li>${n}</li>`).join("")}</ul>`
      : "";

  const postLink = (r: CalcResult) =>
    r.juris.post_slug
      ? `<a href="/posts/${esc(r.juris.post_slug)}/" class="text-accent underline decoration-dashed underline-offset-4">Full post: ${esc(r.juris.name)} →</a>`
      : "";
  const schedLink = (r: CalcResult) =>
    r.juris.fee_schedule_url
      ? `<a href="${esc(r.juris.fee_schedule_url)}" target="_blank" rel="noopener" class="text-accent underline decoration-dashed underline-offset-4">${esc(r.juris.name)} fee schedule ↗</a>`
      : "";

  const areaLabelA = resA.area != null ? ` · ${esc(resA.area)} area` : "";
  const areaLabelB = resB.area != null ? ` · ${esc(resB.area)} area` : "";

  return `
  <div class="grid gap-3 sm:grid-cols-3">
    <div class="border-border rounded-md border p-4">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">A · ${esc(resA.juris.name)}${jurisBadgeHTML(resA.juris.status)}</div>
      <div class="mt-1 text-2xl font-semibold tabular-nums">${fmtRange(resA.totalLow, resA.totalHigh)}</div>
      <div class="text-foreground/80 mt-1 text-sm">at ${a.sqft.toLocaleString("en-US")} sq ft${areaLabelA} · impact fees ${fmtRange(resA.impactLow, resA.impactHigh)}</div>
      <div class="text-foreground/60 mt-2 text-xs">Checked ${esc(resA.juris.last_verified)}</div>
    </div>
    <div class="border-border rounded-md border p-4">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">B · ${esc(resB.juris.name)}${jurisBadgeHTML(resB.juris.status)}</div>
      <div class="mt-1 text-2xl font-semibold tabular-nums">${fmtRange(resB.totalLow, resB.totalHigh)}</div>
      <div class="text-foreground/80 mt-1 text-sm">at ${b.sqft.toLocaleString("en-US")} sq ft${areaLabelB} · impact fees ${fmtRange(resB.impactLow, resB.impactHigh)}</div>
      <div class="text-foreground/60 mt-2 text-xs">Checked ${esc(resB.juris.last_verified)}</div>
    </div>
    <div class="border-border border-accent/40 rounded-md border p-4">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">Difference (B − A)</div>
      <div class="mt-1 text-2xl font-semibold tabular-nums ${diffClass}">${moneyDiffSigned(diffLow)}</div>
      <div class="mt-1 text-sm">${pct} · low end</div>
    </div>
  </div>
  <div class="mt-6 space-y-4" aria-hidden="true">
    ${chartRows}
  </div>
  <div class="relative mt-6 w-full overflow-x-auto">
    <table class="w-full min-w-[36rem] border-collapse text-sm">
      <caption class="sr-only">Fee comparison by category between ${esc(resA.juris.name)} and ${esc(resB.juris.name)}</caption>
      <thead>
        <tr class="border-border border-b text-left">
          <th class="py-2 pe-3 font-semibold">Category</th>
          <th class="py-2 pe-3 text-right font-semibold">A · ${esc(resA.juris.name)}</th>
          <th class="py-2 pe-3 text-right font-semibold">B · ${esc(resB.juris.name)}</th>
          <th class="py-2 text-right font-semibold">Diff (B − A)</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr class="border-border border-t-2 font-semibold">
          <td class="py-3 pe-3">Total</td>
          <td class="py-3 pe-3 text-right tabular-nums">${fmtRange(resA.totalLow, resA.totalHigh)}</td>
          <td class="py-3 pe-3 text-right tabular-nums">${fmtRange(resB.totalLow, resB.totalHigh)}</td>
          <td class="py-3 text-right tabular-nums ${diffClass}">${moneyDiffSigned(diffLow)}</td>
        </tr>
        <tr class="text-foreground/90">
          <td class="py-2 pe-3">$/sq ft (low end)</td>
          <td class="py-2 pe-3 text-right tabular-nums">$${psfA.toLocaleString("en-US")}</td>
          <td class="py-2 pe-3 text-right tabular-nums">$${psfB.toLocaleString("en-US")}</td>
          <td class="py-2 text-right tabular-nums">${moneyDiffSigned(psfB - psfA)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  ${notesHTML}
  <div class="border-border mt-4 flex flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:flex-wrap sm:gap-6">
    ${[postLink(resA), postLink(resB), schedLink(resA), schedLink(resB)].filter(Boolean).join("")}
    <a href="#fee-calculator" class="text-accent underline decoration-dashed underline-offset-4">Line detail in the single-city calculator ↑</a>
  </div>`;
}

// ---------------------------------------------------------------------------
// Verified-stack summary for index-style pages (Fee Index, embed card).
// Same line-value math as the old inline loops, but with proration and
// area-max semantics: dwelling-base flats prorate at the default primary
// (caps applied), and for jurisdictions with mutually exclusive area
// schedules the total is the LARGEST area variant, never the sum of areas.
// Counts follow the Fee Index convention (every verified item in the
// variant, including lines whose method contributes $0 here).
// ---------------------------------------------------------------------------

export interface JurisStack {
  jurisId: string;
  /** Largest area variant's verified total at sqft (rounded). */
  total: number;
  /** Largest area variant's verified impact total at 751 sq ft (rounded). */
  cliff: number;
  /** Verified per-sq-ft school total at sqft, or null. */
  school: number | null;
  /** Verified item count of the max-total variant. */
  count: number;
  /** Area that produced the max total, or null. */
  area: string | null;
}

export function jurisStack(
  data: FeeData,
  jurisId: string,
  sqft: number,
  opts: CalcOpts = {}
): JurisStack {
  const primarySqft = clampPrimary(opts.primarySqft);
  const areas = jurisAreas(data, jurisId);
  const variants: (string | null)[] = areas.length > 0 ? areas : [null];
  const valueAt = (item: FeeItem, size: number): number => {
    if (item.method === "per_sqft") {
      return item.rate_low != null ? item.rate_low * size : 0;
    }
    if (item.method === "flat") {
      if (item.rate_low == null) return 0;
      let v = item.dwelling_base
        ? (size / primarySqft) * item.rate_low
        : item.rate_low;
      if (item.cap != null) v = Math.min(v, item.cap);
      return v;
    }
    return 0;
  };
  let best: JurisStack | null = null;
  let maxCliff = 0;
  for (const variant of variants) {
    const items = data.fee_items.filter(
      i =>
        i.juris_id === jurisId &&
        i.status === "verified" &&
        (variant == null || i.area == null || i.area === variant)
    );
    let total = 0;
    let cliff = 0;
    let school: number | null = null;
    for (const i of items) {
      total += valueAt(i, sqft);
      if (i.category === "impact") {
        cliff += valueAt(i, data.rules.impact_exempt_max_sqft + 1);
      }
      if (i.category === "school" && i.method === "per_sqft" && i.rate_low != null) {
        school = (school ?? 0) + i.rate_low * sqft;
      }
    }
    if (Math.round(cliff) > maxCliff) maxCliff = Math.round(cliff);
    const stack: JurisStack = {
      jurisId,
      total: Math.round(total),
      cliff: maxCliff,
      school: school != null ? Math.round(school) : null,
      count: items.length,
      area: variant,
    };
    if (best == null || stack.total > best.total) best = stack;
  }
  return { ...(best as JurisStack), cliff: maxCliff };
}
