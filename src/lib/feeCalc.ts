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

export function calcLine(
  item: FeeItem,
  juris: Jurisdiction,
  sqft: number,
  rules: FeeRules
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
      return {
        item,
        kind: "ok",
        reason: null,
        low: Math.round(item.rate_low),
        high: item.rate_high != null ? Math.round(item.rate_high) : null,
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
  sqft: number
): CalcResult {
  const juris = data.jurisdictions.find(j => j.juris_id === jurisId);
  if (!juris) {
    throw new Error(`[fee-calculator] unknown jurisdiction "${jurisId}"`);
  }
  const lines = data.fee_items
    .filter(i => i.juris_id === jurisId)
    .map(item => calcLine(item, juris, sqft, data.rules))
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
  sqft: number
): string {
  const r = calcJurisdiction(data, jurisId, sqft);
  const at750 = calcJurisdiction(data, jurisId, data.rules.impact_exempt_max_sqft);
  const at751 = calcJurisdiction(data, jurisId, data.rules.impact_exempt_max_sqft + 1);

  const badge = jurisBadgeHTML(r.juris.status);
  const totalText = fmtRange(r.totalLow, r.totalHigh);
  const impactText = fmtRange(r.impactLow, r.impactHigh);

  const deltaLow = at751.totalLow - at750.totalLow;
  const deltaHigh =
    at751.totalHigh != null && at750.totalHigh != null
      ? at751.totalHigh - at750.totalHigh
      : null;
  const hasImpactItems = r.lines.some(
    l => l.item.category === "impact" && l.kind !== "skipped"
  );

  const cliffText = hasImpactItems
    ? `At ${data.rules.impact_exempt_max_sqft} sq ft, this jurisdiction's impact fees are <strong>${fmtRange(at750.impactLow, at750.impactHigh)}</strong> — state law bars them. At ${data.rules.impact_exempt_max_sqft + 1} sq ft they become <strong>${fmtRange(at751.impactLow, at751.impactHigh)}</strong>, and the fee total jumps by about <strong>${fmtRange(deltaLow, deltaHigh)}</strong>. Drag the slider across 750 to watch it happen.`
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
      <div class="text-foreground/80 mt-1 text-sm">at ${sqft.toLocaleString("en-US")} sq ft · impact fees ${impactText}</div>
      <div class="text-foreground/60 mt-2 text-xs">Checked ${esc(r.juris.last_verified)} · <a href="${esc(r.juris.fee_schedule_url)}" target="_blank" rel="noopener" class="text-accent underline decoration-dashed underline-offset-4">fee schedule ↗</a></div>
    </div>
    <div class="rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30">
      <div class="text-foreground/70 text-xs tracking-wide uppercase">The 750 sq ft cliff</div>
      <p class="mt-1 text-sm">${cliffText}</p>
    </div>
  </div>
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
  <p class="text-foreground/70 mt-2 text-xs">Full breakdown with methodology notes: <a href="/posts/${esc(r.juris.post_slug)}/" class="text-accent underline decoration-dashed underline-offset-4">Read the ${esc(r.juris.name)} post →</a></p>`;
}
