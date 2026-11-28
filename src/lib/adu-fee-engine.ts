// ============================================================================
// Every Line Item — California ADU Fee & Soft Cost Sync Pure Function Engine
// Zero dependencies · Pure TypeScript (strict: true compatible)
// ============================================================================
//
// This module computes ADU fees from verified jurisdiction data and syncs
// them into the Quote Checker soft-costs phase. It never fabricates a
// number: anything not verified is excluded from every total and reported
// only as an exposure range or a gap count.
//
// Corrections applied against the first draft (reviewed 2026-11-28 against
// fees.json on origin/main and the live /fees/ pages):
//   1. Flat + SB 1117: a flat fee converts to the excess area ONLY when
//      sb1117FlatBasis === 'prorate_excess' is explicitly recorded.
//      Undefined or 'unpublished' returns null (never a silent prorate),
//      matching feeCalc.ts, which reports unconverted flat lines as
//      uncertain and never guesses.
//   2. Tier miss is a distinct reason ('not_applicable_at_size'): a tiered
//      line whose tier does not cover the ADU size is excluded from every
//      count, so it never inflates unverifiedCount. (San Jose FI-008 /
//      FI-011 at 800 sq ft are the reference case.)
//   3. 'valuation_step' calcType added (Ontario permit FI-322: base $1,288
//      + $7 per $1,000 of valuation over $100,000). Formula matches
//      feeCalc.ts: base + rate x (valuation - threshold) / step.
//   4. Flat rows that carry a min/max_sqft range in fees.json map to
//      'sqft_tiered' in the adapter (see the adapter contract below), so a
//      ranged flat fee is never applied outside its size band.
//   5. verifiedCategoryRatio = categories with a verified amount above $0
//      / 5 total categories. This matches the /compare/ badge
//      ("Partial · 2/5 verified"). "Pending" = total - verified, which
//      lumps lines still being verified and categories with no rows on
//      file; the UI tells them apart via CategorySummary (unverifiedCount
//      > 0 means pending, all counts zero means no data).
//   6. Partial categories: a jurisdiction can record known-incomplete
//      shares (Ontario school fees: only the Chaffey HSD 9-12 share is
//      verified; the Ontario-Montclair ESD share has no verified row).
//      The note surfaces in the calculation and the sync summary so the
//      UI never presents a partial amount as complete.
//   7. No silent valuation default. A valuation-based line without a
//      valuation basis (line.valuationPerSqFt, or the caller's explicit
//      ctx.defaultValuationPerSqFt) returns 'no_valuation_basis', matching
//      feeCalc.ts, which skips such lines instead of guessing a value.
//      The old DEFAULT_VALUATION_PER_SQFT ($175) is removed on purpose.
//
// Adapter contract (fees.json -> JurisdictionRecord), for the Phase 2
// /compare/ adapter. The adapter owns the mapping; the engine owns the
// math. Violating any row below makes the engine's guarantees void:
//   - juris_id -> id (lowercase slug). LA-BASE is the series baseline
//     model (isBaselineModel: true), never a selectable jurisdiction.
//   - area -> areaScheduleId (slugified). Ontario "General City" and
//     "Ontario Ranch" are mutually exclusive schedules; a parcel pays
//     one, never both.
//   - method 'flat' + dwelling_base -> 'prorated_dwelling', rate = rate_low.
//   - method 'flat' + min_sqft/max_sqft present -> 'sqft_tiered', one tier
//     per row (flatAmount = rate_low, null when rate_low is null).
//   - method 'flat' (no range) -> 'flat', rate = rate_low.
//   - method 'per_sqft' -> 'per_sqft', rate = rate_low.
//   - method 'pct_valuation' -> 'valuation_percent', rate = rate_low,
//     valuationPerSqFt = the jurisdiction's valuation_psf.
//   - method 'valuation_step' -> 'valuation_step', rate = rate_low,
//     base/threshold/step from the row.
//   - category: plan_check_permit -> plan_check_permits; school ->
//     school_fees; impact -> impact_fees; water_sewer ->
//     utility_connection; planning and construction_tax -> planning_taxes.
//   - status: verified -> 'verified'; to_verify / conflict -> 'verifying'.
//   - exemptAtOrBelowSqFt: school -> 499 (rules.school_exempt_below_sqft
//     is 500, so below 500); impact -> 750
//     (rules.impact_exempt_max_sqft). When absent, the engine falls back
//     to the category default in CATEGORY_EXEMPT_MAX.
//   - sb1117Eligible: true only for impact_fees lines (school fees,
//     plan check, utility connection/capacity charges and planning taxes
//     are not covered by SB 1117). A flat impact line additionally needs
//     sb1117FlatBasis === 'prorate_excess' recorded before it converts.
//   - unverifiedRange: for a verifying line, [rate_low, rate_high] when
//     published, or a single published figure twice (San Jose school
//     FI-013 uses the Level I cap $5.38/sq ft x 800 = $4,304 as exposure
//     only). Ranges are exposure, never summed.
//   - partialCategories: from the site's known-incomplete shares
//     (PARTIAL_SCHOOL_JURIS in src/pages/fees/index.astro today).
//
// Data provenance: the worked Ontario and San Jose figures asserted by
// the test file (src/lib/adu-fee-engine.test.ts) are taken from fees.json
// on origin/main and cross-checked against feeCalc.ts on the same data
// and the live /fees/ontario/ and /fees/san-jose/ pages.

export type TaxYearRule = "2026" | "2027_sb1117";
export type LineStatus = "not_listed" | "included" | "allowance" | "excluded";
export type SoftCostSyncMode = "synced_city" | "regional_default";

export type FeeCategory =
  | "plan_check_permits"
  | "school_fees"
  | "impact_fees"
  | "utility_connection"
  | "planning_taxes";

export type VerificationStatus = "verified" | "verifying" | "not_published";

export type CalcRuleType =
  | "flat"
  | "per_sqft"
  | "prorated_dwelling"
  | "valuation_percent"
  | "sqft_tiered"
  | "valuation_step";

export type PhaseKey =
  | "soft_costs"
  | "site_foundation"
  | "framing_structure"
  | "building_envelope"
  | "systems_interior"
  | "landscaping_hardscape"
  | "crane_transport";

export interface FeeTier {
  minSqFt: number;
  maxSqFt: number; // 상한 없음일 경우 Infinity 또는 99999
  /** null: the tier covers this size but no amount is published for it. */
  flatAmount: number | null;
}

export interface FeeLineItem {
  id: string;
  label: string;
  category: FeeCategory;
  /** null이면 지자체 전 구역 공통, 문자열이면 특정 구역 요율표 전용 */
  areaScheduleId: string | null;
  status: VerificationStatus;
  calcType: CalcRuleType;
  /**
   * verified일 때 계산 기준 수치:
   * - flat: 정액 ($)
   * - per_sqft: 평방피트당 단가 ($/sq ft)
   * - prorated_dwelling: 기준 단독주택 정액 ($/dwelling)
   * - valuation_percent: 산정 건축비 대비 소수 요율 (예: 3.96% -> 0.0396)
   * - valuation_step: step당 단가 ($/step)
   * - sqft_tiered: null (tiers 배열 사용)
   */
  rate: number | null;
  /** valuation_percent / valuation_step 계산 시 사용하는 지자체 표준 단가 ($/sq ft), 미지정 시 기본값 적용 */
  valuationPerSqFt?: number;
  /** valuation_step 전용: 정액 기본료 ($) */
  base?: number;
  /** valuation_step 전용: 과세 기준 건축비 하한 ($) */
  threshold?: number;
  /** valuation_step 전용: 단가 적용 단위 ($) */
  step?: number;
  /** 지자체별 상한액 (예: Westminster 공원 DIF $4,000 상한) */
  flatCap?: number;
  /** 검증 출처 표시용 (UI의 "Verified" 링크). 선택 사항. */
  sourceLabel?: string;
  /** 검증 출처 표시용 (UI의 "Verified" 링크). 선택 사항. */
  sourceUrl?: string;
  /**
   * 이 행을 마지막으로 검증한 날짜. ''이면 검증일 없음(never verified).
   * 어댑터는 항상 값을 채워야 한다 — 빈 문자열도 명시적으로.
   */
  lastVerified: string;
  /** verifying 상태일 때 참고용 예상 노출 범위 (합계 산입 절대 금지) */
  unverifiedRange?: [number, number];
  /**
   * 법정 면제 상한 면적 (이하 면제):
   * - 학군 부담금(Ed. Code §17620 / SB 543): 499 (500 sq ft 미만 면제)
   * - 개발부담금(Gov. Code §66311.5): 750 (750 sq ft 이하 면제)
   * - 그 외 카테고리: 면제 없음 (undefined)
   * ※ 면제는 법정 사실이므로 verifying 행에도 적용된다: 면제 크기에서는
   * 금액이 $0으로 확정돼 미검증 집계에 들어가지 않는다.
   */
  exemptAtOrBelowSqFt?: number;
  /** SB 1117(2027년) 적용 대상 항목인지 여부 (개발부담금 항목만 해당) */
  sb1117Eligible?: boolean;
  /**
   * SB 1117 적용 시 정액 항목 변환 방식:
   * - 'prorate_excess': 초과 면적 기준으로 비례 환산 (명시된 경우에만)
   * - 'unpublished': 변환 방식 미공표 (절감액 산출 불가)
   * - undefined: 'unpublished'와 동일 — 명시 근거 없으면 변환하지 않는다.
   */
  sb1117FlatBasis?: "prorate_excess" | "unpublished";
  /** 구간 요율표 전용: 면적 구간별 정액 */
  tiers?: FeeTier[];
}

export interface AreaSchedule {
  id: string;
  label: string;
}

export interface PartialCategoryNote {
  category: FeeCategory;
  /** What is verified and what is still missing, in plain language. */
  note: string;
}

export interface JurisdictionRecord {
  id: string;
  name: string;
  county: string;
  region: "Bay Area" | "Central Coast" | "NorCal" | "SoCal";
  isBaselineModel?: boolean;
  postUrl?: string | null;
  feeScheduleUrl?: string | null;
  lastVerified: string;
  areaSchedules?: AreaSchedule[];
  feeLines: FeeLineItem[];
  /**
   * Known-incomplete shares: a category whose verified amount covers only
   * part of the real fee (e.g. Ontario school fees — only the Chaffey HSD
   * 9-12 share is verified; the Ontario-Montclair ESD share has no
   * verified row). The engine reports these alongside the totals so the
   * UI never presents a partial amount as complete.
   */
  partialCategories?: PartialCategoryNote[];
}

export type ExemptionReason =
  | "below_school_fee_threshold"
  | "impact_fee_exempt"
  | "unverified"
  | "sb1117_conversion_unpublished"
  | "not_applicable_at_size"
  | "no_valuation_basis";

export interface FeeLineCalculation {
  lineId: string;
  amount: number | null;
  isExempt: boolean;
  isUnverified: boolean;
  exemptionReason: ExemptionReason | null;
  formulaNote: string;
}

export interface CategorySummary {
  category: FeeCategory;
  lines: FeeLineCalculation[];
  verifiedCount: number;
  verifiedAmount: number;
  exemptedAmount: number;
  unverifiedCount: number;
  unverifiedRange: [number, number] | null;
  unpublishedSb1117Count: number;
}

export interface JurisdictionFeeCalculation {
  jurisdiction: JurisdictionRecord;
  aduSqFt: number;
  primarySqFt: number;
  taxYearRule: TaxYearRule;
  effectiveAreaScheduleId: string | null;
  byCategory: Record<FeeCategory, CategorySummary>;
  verifiedTotal: number;
  unverifiedCount: number;
  unverifiedExposureRange: [number, number] | null;
  /** Categories with a verified amount above $0 / all 5 categories. */
  verifiedCategoryRatio: { verified: number; total: number };
  sb1117SavingsAtCurrentSize: number | null;
  sb1117SavingsUnpublished: boolean;
  cliffDeltaAt751: number | null;
  partialCategoryNotes: PartialCategoryNote[];
}

export interface SoftCostSyncSummary {
  mode: SoftCostSyncMode;
  designAllowance: number;
  verifiedGovFees: number;
  combinedPhase1Benchmark: number;
  unverifiedCount: number;
  unverifiedExposureRange: [number, number] | null;
  sb1117Savings: number | null;
  sb1117SavingsUnpublished: boolean;
  cliffDeltaAt751: number | null;
  verificationBadge: string;
  partialCategoryNotes: PartialCategoryNote[];
  jurisdictionsCount: number;
  lastVerified: string;
}

export interface QuoteLine {
  phase: PhaseKey;
  status: LineStatus;
  amount: number;
}

export interface QuoteDraft {
  softCosts: QuoteLine;
  phases: QuoteLine[];
}

export type FlagSeverity = "critical" | "warning" | "info";

export interface QuoteFlag {
  code:
    | "SC_BELOW_GOV_FEES"
    | "SC_EXCLUDED_OR_ALLOWANCE"
    | "SC_UNVERIFIED_GAP"
    | "SC_SB1117_UNPUBLISHED"
    | "SC_CLIFF_WARNING"
    | "PHASE_MISSING";
  severity: FlagSeverity;
  title: string;
  detail: string;
  phase?: PhaseKey;
  learnMoreUrl?: string;
}

export const ALL_CATEGORIES: FeeCategory[] = [
  "plan_check_permits",
  "school_fees",
  "impact_fees",
  "utility_connection",
  "planning_taxes",
];

export const ALL_PHASES: PhaseKey[] = [
  "soft_costs",
  "site_foundation",
  "framing_structure",
  "building_envelope",
  "systems_interior",
  "landscaping_hardscape",
  "crane_transport",
];

export const DEFAULT_DESIGN_ALLOWANCE = 14000;
export const DEFAULT_PRIMARY_SQFT = 1600;
export const SB_1117_THRESHOLD_SQFT = 750;
export const SCHOOL_FEE_EXEMPT_MAX_SQFT = 499;
export const DEFAULT_JURISDICTION_ID = "ontario";

export const REGION_SORT_ORDER: Record<string, number> = {
  "Bay Area": 0,
  "Central Coast": 1,
  NorCal: 2,
  SoCal: 3,
};

/** Category-level statutory exemption caps. Lines may override these. */
export const CATEGORY_EXEMPT_MAX: Partial<Record<FeeCategory, number>> = {
  school_fees: SCHOOL_FEE_EXEMPT_MAX_SQFT,
  impact_fees: SB_1117_THRESHOLD_SQFT,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Determines the tax-year rule from the quote date. SB 1117 takes effect
 * Jan 1, 2027 (Gov. Code §66311.5, as amended by SB 1117, Ch. 809).
 */
export function getDefaultTaxYearRule(dateISO: string): TaxYearRule {
  return dateISO >= "2027-01-01" ? "2027_sb1117" : "2026";
}

export function calculateFeeLine(
  line: FeeLineItem,
  aduSqFt: number,
  taxYearRule: TaxYearRule,
  ctx: { primarySqft?: number; defaultValuationPerSqFt?: number } = {}
): FeeLineCalculation {
  const primarySqFt = ctx.primarySqft ?? DEFAULT_PRIMARY_SQFT;
  const clampedSqFt = Math.max(0, Math.round(aduSqFt));
  const applySb1117 =
    taxYearRule === "2027_sb1117" && line.sb1117Eligible === true;
  const taxableSqFt = applySb1117
    ? Math.max(0, clampedSqFt - SB_1117_THRESHOLD_SQFT)
    : clampedSqFt;

  // 1. Exemption is a legal fact, not a fee amount: it applies even to
  // lines that are still being verified, and it is checked before the
  // verification gate so an exempt line never counts as "pending".
  const effectiveExemptMax =
    line.exemptAtOrBelowSqFt ?? CATEGORY_EXEMPT_MAX[line.category];
  if (effectiveExemptMax != null && clampedSqFt <= effectiveExemptMax) {
    return {
      lineId: line.id,
      amount: 0,
      isExempt: true,
      isUnverified: false,
      exemptionReason:
        line.category === "school_fees"
          ? "below_school_fee_threshold"
          : "impact_fee_exempt",
      formulaNote: `Exempt by state law: ADUs of ${effectiveExemptMax} sq ft or less pay $0 for this category.`,
    };
  }

  // 2. Tiered flat fees: the tier is a property of the ADU's total size.
  // Under SB 1117 a tiered flat fee has no published conversion (the tier
  // is defined on total size, not excess area), so it is never guessed.
  if (line.calcType === "sqft_tiered") {
    if (applySb1117) {
      return {
        lineId: line.id,
        amount: null,
        isExempt: false,
        isUnverified: false,
        exemptionReason: "sb1117_conversion_unpublished",
        formulaNote: "No published SB 1117 conversion for tiered flat fees.",
      };
    }
    const tier = line.tiers?.find(
      t => clampedSqFt >= t.minSqFt && clampedSqFt <= t.maxSqFt
    );
    if (tier == null) {
      return {
        lineId: line.id,
        amount: null,
        isExempt: false,
        isUnverified: false,
        exemptionReason: "not_applicable_at_size",
        formulaNote: `No published fee tier covers ${clampedSqFt} sq ft.`,
      };
    }
    if (tier.flatAmount == null) {
      return {
        lineId: line.id,
        amount: null,
        isExempt: false,
        isUnverified: true,
        exemptionReason: "unverified",
        formulaNote: `Tier covers ${clampedSqFt} sq ft but no published amount for this tier.`,
      };
    }
    if (line.status !== "verified") {
      return {
        lineId: line.id,
        amount: null,
        isExempt: false,
        isUnverified: true,
        exemptionReason: "unverified",
        formulaNote: `Tier amount $${tier.flatAmount.toLocaleString("en-US")} is still being verified.`,
      };
    }
    return {
      lineId: line.id,
      amount: round2(tier.flatAmount),
      isExempt: false,
      isUnverified: false,
      exemptionReason: null,
      formulaNote: `Tier ${tier.minSqFt}–${tier.maxSqFt} sq ft: flat $${tier.flatAmount.toLocaleString("en-US")}.`,
    };
  }

  // 3. Verification gate: unverified lines never enter a total.
  if (line.status !== "verified") {
    return {
      lineId: line.id,
      amount: null,
      isExempt: false,
      isUnverified: true,
      exemptionReason: "unverified",
      formulaNote: "Line is still being verified; excluded from totals.",
    };
  }

  // 4. Calculation dispatch.
  let amount: number | null = null;
  let formulaNote = "";
  switch (line.calcType) {
    case "flat": {
      if (applySb1117) {
        if (line.sb1117FlatBasis !== "prorate_excess") {
          return {
            lineId: line.id,
            amount: null,
            isExempt: false,
            isUnverified: false,
            exemptionReason: "sb1117_conversion_unpublished",
            formulaNote: "No published SB 1117 conversion for this flat fee.",
          };
        }
        amount = round2(((line.rate ?? 0) * taxableSqFt) / primarySqFt);
        formulaNote = `Flat fee prorated to excess area: $${line.rate} × ${taxableSqFt}/${primarySqFt} sq ft.`;
      } else {
        amount = round2(line.rate ?? 0);
        formulaNote = `Flat fee: $${line.rate}.`;
      }
      break;
    }
    case "per_sqft": {
      amount = round2((line.rate ?? 0) * taxableSqFt);
      formulaNote = applySb1117
        ? `$${line.rate}/sq ft × ${taxableSqFt} sq ft (excess over 750).`
        : `$${line.rate}/sq ft × ${taxableSqFt} sq ft.`;
      break;
    }
    case "prorated_dwelling": {
      amount = round2(((line.rate ?? 0) * taxableSqFt) / primarySqFt);
      formulaNote = applySb1117
        ? `Dwelling-base fee on excess area: $${line.rate} × ${taxableSqFt}/${primarySqFt} sq ft.`
        : `Dwelling-base fee: $${line.rate} × ${taxableSqFt}/${primarySqFt} sq ft.`;
      break;
    }
    case "valuation_percent": {
      const valPerSqFt = line.valuationPerSqFt ?? ctx.defaultValuationPerSqFt;
      if (valPerSqFt == null) {
        return {
          lineId: line.id,
          amount: null,
          isExempt: false,
          isUnverified: true,
          exemptionReason: "no_valuation_basis",
          formulaNote: "No valuation basis on file for this jurisdiction.",
        };
      }
      amount = round2((line.rate ?? 0) * valPerSqFt * taxableSqFt);
      formulaNote = `$${(line.rate ?? 0) * 100}% of valuation ($${valPerSqFt}/sq ft × ${taxableSqFt} sq ft).`;
      break;
    }
    case "valuation_step": {
      const valPerSqFt = line.valuationPerSqFt ?? ctx.defaultValuationPerSqFt;
      if (valPerSqFt == null) {
        return {
          lineId: line.id,
          amount: null,
          isExempt: false,
          isUnverified: true,
          exemptionReason: "no_valuation_basis",
          formulaNote: "No valuation basis on file for this jurisdiction.",
        };
      }
      const valuation = valPerSqFt * taxableSqFt;
      const threshold = line.threshold ?? 0;
      const step = line.step ?? 1;
      const base = line.base ?? 0;
      if (valuation < threshold) {
        return {
          lineId: line.id,
          amount: null,
          isExempt: false,
          isUnverified: false,
          exemptionReason: "not_applicable_at_size",
          formulaNote: `Valuation $${valuation.toLocaleString("en-US")} is below the schedule threshold $${threshold.toLocaleString("en-US")}.`,
        };
      }
      amount = round2(
        base + (line.rate ?? 0) * ((valuation - threshold) / step)
      );
      formulaNote = `$${base} + $${line.rate} per $${step} of valuation over $${threshold}.`;
      break;
    }
  }

  if (line.flatCap != null && amount != null) {
    amount = round2(Math.min(amount, line.flatCap));
  }
  return {
    lineId: line.id,
    amount,
    isExempt: false,
    isUnverified: false,
    exemptionReason: null,
    formulaNote,
  };
}

export function filterActiveLines(
  record: JurisdictionRecord,
  areaScheduleId: string | null
): FeeLineItem[] {
  return record.feeLines.filter(
    l => l.areaScheduleId == null || l.areaScheduleId === areaScheduleId
  );
}

export function resolveAreaSchedule(
  record: JurisdictionRecord,
  requestedAreaId: string | null
): string | null {
  if (requestedAreaId != null) return requestedAreaId;
  return record.areaSchedules?.[0]?.id ?? null;
}

export function calculateJurisdictionFees(
  record: JurisdictionRecord,
  aduSqFt: number,
  primarySqFt: number,
  taxYearRule: TaxYearRule,
  requestedAreaScheduleId: string | null = null
): JurisdictionFeeCalculation {
  const resolvedAreaId = resolveAreaSchedule(record, requestedAreaScheduleId);
  const byCategory = {} as Record<FeeCategory, CategorySummary>;
  for (const category of ALL_CATEGORIES) {
    byCategory[category] = {
      category,
      lines: [],
      verifiedCount: 0,
      verifiedAmount: 0,
      exemptedAmount: 0,
      unverifiedCount: 0,
      unverifiedRange: null,
      unpublishedSb1117Count: 0,
    };
  }

  for (const line of filterActiveLines(record, resolvedAreaId)) {
    const calc = calculateFeeLine(line, aduSqFt, taxYearRule, {
      primarySqft: primarySqFt,
    });
    const cat = byCategory[line.category];
    cat.lines.push(calc);

    // A line whose tier does not cover this size is not a fee for this
    // size at all: it is excluded from every count.
    if (calc.exemptionReason === "not_applicable_at_size") {
      continue;
    }
    if (calc.exemptionReason === "sb1117_conversion_unpublished") {
      cat.unpublishedSb1117Count += 1;
      continue;
    }
    if (calc.amount != null) {
      cat.verifiedCount += 1;
      cat.verifiedAmount += calc.amount;
      if (calc.isExempt) cat.exemptedAmount += calc.amount;
    } else {
      // Any other null amount (unverified, or no valuation basis) is a
      // gap: excluded from the total, reported as exposure only when a
      // published range exists.
      cat.unverifiedCount += 1;
      if (line.unverifiedRange) {
        const [lo, hi] = line.unverifiedRange;
        if (cat.unverifiedRange == null) {
          cat.unverifiedRange = [lo, hi];
        } else {
          cat.unverifiedRange = [
            cat.unverifiedRange[0] + lo,
            cat.unverifiedRange[1] + hi,
          ];
        }
      }
    }
  }

  const verifiedTotal = round2(
    ALL_CATEGORIES.reduce((sum, c) => sum + byCategory[c].verifiedAmount, 0)
  );
  const unverifiedCount = ALL_CATEGORIES.reduce(
    (sum, c) => sum + byCategory[c].unverifiedCount,
    0
  );
  const unverifiedExposureRange: [number, number] | null =
    unverifiedCount === 0
      ? null
      : ALL_CATEGORIES.reduce<[number, number] | null>((acc, c) => {
          const range = byCategory[c].unverifiedRange;
          if (range == null) return acc;
          return acc == null
            ? [range[0], range[1]]
            : [acc[0] + range[0], acc[1] + range[1]];
        }, null);

  // Badge ratio: categories with a verified amount above $0, out of all
  // five categories. "Pending" (total - verified) lumps lines still being
  // verified and categories with no rows on file; the UI tells them apart
  // via CategorySummary (unverifiedCount > 0 = pending, all counts zero =
  // no data).
  const verifiedCategories = ALL_CATEGORIES.filter(
    c => byCategory[c].verifiedAmount > 0
  ).length;
  const verifiedCategoryRatio = {
    verified: verifiedCategories,
    total: ALL_CATEGORIES.length,
  };

  // SB 1117 comparison: re-run the eligible verified lines under both
  // rules. If any eligible line has no published 2027 conversion, the
  // saving is null, never a guess.
  let sb1117SavingsAtCurrentSize: number | null = null;
  let sb1117SavingsUnpublished = false;
  if (taxYearRule === "2026") {
    let sum2026 = 0;
    let sum2027 = 0;
    let anyUnpublished = false;
    for (const line of filterActiveLines(record, resolvedAreaId)) {
      if (line.sb1117Eligible !== true || line.status !== "verified") {
        continue;
      }
      const r26 = calculateFeeLine(line, aduSqFt, "2026", {
        primarySqft: primarySqFt,
      });
      const r27 = calculateFeeLine(line, aduSqFt, "2027_sb1117", {
        primarySqft: primarySqFt,
      });
      if (r27.exemptionReason === "sb1117_conversion_unpublished") {
        anyUnpublished = true;
        continue;
      }
      sum2026 += r26.amount ?? 0;
      sum2027 += r27.amount ?? 0;
    }
    if (anyUnpublished) {
      sb1117SavingsUnpublished = true;
    } else if (sum2026 > 0) {
      sb1117SavingsAtCurrentSize = round2(sum2026 - sum2027);
    }
  }

  // The 750 sq ft cliff: compare verified impact fees at 750 vs 751.
  let cliffDeltaAt751: number | null = null;
  {
    let at750 = 0;
    let at751 = 0;
    for (const line of filterActiveLines(record, resolvedAreaId)) {
      if (line.category !== "impact_fees" || line.status !== "verified") {
        continue;
      }
      const c750 = calculateFeeLine(line, 750, "2026", {
        primarySqft: primarySqFt,
      });
      const c751 = calculateFeeLine(line, 751, "2026", {
        primarySqft: primarySqFt,
      });
      at750 += c750.amount ?? 0;
      at751 += c751.amount ?? 0;
    }
    if (at751 > at750) {
      cliffDeltaAt751 = round2(at751 - at750);
    }
  }

  return {
    jurisdiction: record,
    aduSqFt,
    primarySqFt,
    taxYearRule,
    effectiveAreaScheduleId: resolvedAreaId,
    byCategory,
    verifiedTotal,
    unverifiedCount,
    unverifiedExposureRange,
    verifiedCategoryRatio,
    sb1117SavingsAtCurrentSize,
    sb1117SavingsUnpublished,
    cliffDeltaAt751,
    partialCategoryNotes: (record.partialCategories ?? []).map(p => ({
      category: p.category,
      note: p.note,
    })),
  };
}

export function buildSoftCostSyncSummary(
  feeCalc: JurisdictionFeeCalculation,
  jurisdictionsCount: number,
  designAllowance: number = DEFAULT_DESIGN_ALLOWANCE
): SoftCostSyncSummary {
  const verifiedGovFees = feeCalc.verifiedTotal;
  const combinedPhase1Benchmark = round2(designAllowance + verifiedGovFees);
  const verified = feeCalc.verifiedCategoryRatio.verified;
  const total = feeCalc.verifiedCategoryRatio.total;
  const verificationBadge =
    verified === total
      ? `Verified · ${verified}/${total} categories`
      : `Partial · ${verified}/${total} verified · ${total - verified} pending`;
  return {
    mode: "synced_city",
    designAllowance,
    verifiedGovFees,
    combinedPhase1Benchmark,
    unverifiedCount: feeCalc.unverifiedCount,
    unverifiedExposureRange: feeCalc.unverifiedExposureRange,
    sb1117Savings: feeCalc.sb1117SavingsAtCurrentSize,
    sb1117SavingsUnpublished: feeCalc.sb1117SavingsUnpublished,
    cliffDeltaAt751: feeCalc.cliffDeltaAt751,
    verificationBadge,
    partialCategoryNotes: feeCalc.partialCategoryNotes,
    jurisdictionsCount,
    lastVerified: feeCalc.jurisdiction.lastVerified,
  };
}

export function evaluateQuoteFlags(
  quote: QuoteDraft,
  syncSummary: SoftCostSyncSummary,
  benchmarks: Record<PhaseKey, number>,
  options: {
    jurisdictionPostUrl?: string | null;
    sb1117ExplainerUrl?: string | null;
    isModularBenchmark?: boolean;
  } = {}
): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  const phases = quote.phases;
  const quotedTotal = phases.reduce((sum, l) => sum + l.amount, 0);
  const pricedPhases = phases.filter(l => l.status !== "not_listed");
  const pricedPhasesCount = pricedPhases.length;

  // 1. Soft costs below the verified government fees alone.
  if (
    quote.softCosts.amount > 0 &&
    quote.softCosts.status !== "excluded" &&
    syncSummary.verifiedGovFees > quote.softCosts.amount
  ) {
    flags.push({
      code: "SC_BELOW_GOV_FEES",
      severity: "critical",
      title: `Your soft costs are below the government fees alone`,
      detail: `This city charges $${syncSummary.verifiedGovFees.toLocaleString("en-US")} in verified government fees at this size, but your quote lists $${quote.softCosts.amount.toLocaleString("en-US")} for soft costs — the budget is short before design and permits are even counted. Ask your builder which fees this line item is supposed to cover.`,
      phase: "soft_costs",
      learnMoreUrl: options.jurisdictionPostUrl ?? undefined,
    });
  }

  // 2. Soft costs excluded or listed as an allowance.
  if (
    quote.softCosts.status === "excluded" ||
    quote.softCosts.status === "allowance"
  ) {
    flags.push({
      code: "SC_EXCLUDED_OR_ALLOWANCE",
      severity: "warning",
      title: `Soft costs are ${quote.softCosts.status === "excluded" ? "not in your quote" : "an allowance, not a price"}`,
      detail:
        quote.softCosts.status === "excluded"
          ? `Design, permits and fees are not in this quote. Expect at least $${syncSummary.combinedPhase1Benchmark.toLocaleString("en-US")} in soft costs on top of the quoted total.`
          : `Your quote lists soft costs as an allowance. Your final bill can exceed it. The verified city fees alone are $${syncSummary.verifiedGovFees.toLocaleString("en-US")} — confirm the allowance covers them before you sign.`,
      phase: "soft_costs",
      learnMoreUrl: options.jurisdictionPostUrl ?? undefined,
    });
  }

  // 3. Unverified fees excluded from the total (estimated exposure only).
  if (syncSummary.unverifiedCount > 0) {
    flags.push({
      code: "SC_UNVERIFIED_GAP",
      severity: "warning",
      title: `${syncSummary.unverifiedCount} fee line${syncSummary.unverifiedCount > 1 ? "s" : ""} still being verified`,
      detail:
        syncSummary.unverifiedExposureRange == null
          ? `These fees are not in the total yet. We are still verifying them with the city — ask your builder for the current schedule before you budget.`
          : `These fees are not in the total yet. The published range is $${syncSummary.unverifiedExposureRange[0].toLocaleString("en-US")}–$${syncSummary.unverifiedExposureRange[1].toLocaleString("en-US")} — treat that as exposure, not a price, until the city confirms it.`,
      phase: "soft_costs",
      learnMoreUrl: options.jurisdictionPostUrl ?? undefined,
    });
  }

  // 4. SB 1117 conversion not yet published (2027 rule only).
  if (syncSummary.sb1117SavingsUnpublished) {
    flags.push({
      code: "SC_SB1117_UNPUBLISHED",
      severity: "warning",
      title: "SB 1117 savings not yet published for this city",
      detail: `The 2027 excess-area rule applies, but this city has not published how its flat fees convert. We do not estimate the saving — check the city's 2027 fee schedule.`,
      phase: "soft_costs",
      learnMoreUrl: options.sb1117ExplainerUrl ?? undefined,
    });
  }

  // 5. The 750 sq ft cliff: a 1 sq ft increase crosses the exemption line.
  if (
    syncSummary.cliffDeltaAt751 != null &&
    syncSummary.cliffDeltaAt751 >= 1000
  ) {
    flags.push({
      code: "SC_CLIFF_WARNING",
      severity: "info",
      title: `Building 1 sq ft bigger crosses the 750 sq ft cliff`,
      detail: `Impact fees are $0 at 750 sq ft, but $${syncSummary.cliffDeltaAt751.toLocaleString("en-US")} at 751 sq ft. If your design is near the line, confirm the exact size before the permit is filed.`,
      phase: "soft_costs",
      learnMoreUrl: options.sb1117ExplainerUrl ?? undefined,
    });
  }

  // 6. Missing phases (general rule, checked for every priced quote).
  if (pricedPhasesCount >= 4 && quotedTotal > 0) {
    const activePhases = options.isModularBenchmark
      ? ALL_PHASES
      : ALL_PHASES.filter(p => p !== "crane_transport");
    for (const phase of activePhases) {
      if (phase === "soft_costs") continue;
      const line = phases.find(l => l.phase === phase);
      if (line == null || line.status === "excluded") {
        flags.push({
          code: "PHASE_MISSING",
          severity: "warning",
          title: `${phase.replace(/_/g, " ")} is missing from your quote`,
          detail:
            benchmarks[phase] > 0
              ? `This phase is not priced in your quote. The benchmark is $${benchmarks[phase].toLocaleString("en-US")} — ask your builder whether it is included elsewhere or still to come.`
              : `This phase is not priced in your quote. Ask your builder whether it is included elsewhere or still to come.`,
          phase,
        });
      }
    }
  }

  const severityRank: Record<FlagSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return flags.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
}
