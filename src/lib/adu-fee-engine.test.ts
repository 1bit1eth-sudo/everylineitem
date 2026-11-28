// ============================================================================
// Tests for src/lib/adu-fee-engine.ts
// Run: node --test src/lib/adu-fee-engine.test.ts
//
// Fixtures are mapped from real fees.json rows on origin/main (2026-11-28)
// and asserted against the live published totals on /fees/ontario/ and
// /fees/san-jose/. The last block cross-checks the new engine against the
// existing feeCalc.ts on the same raw data: the two engines must agree
// within $1 per total (feeCalc rounds each line to whole dollars; this
// engine keeps cents and rounds only for display).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSoftCostSyncSummary,
  calculateFeeLine,
  calculateJurisdictionFees,
  evaluateQuoteFlags,
  getDefaultTaxYearRule,
  type FeeLineItem,
  type JurisdictionRecord,
  type QuoteDraft,
} from "./adu-fee-engine.ts";
import { calcJurisdiction, type FeeData } from "./feeCalc.ts";

// --- Ontario (General City + Ontario Ranch) ---------------------------------
// FI-320 DIF General City base $37,595 (Res. 2025-010), FI-321 DIF Ontario
// Ranch base $58,576 (Res. 2025-089), FI-319 school Chaffey HSD $1.67/sq
// ft (9-12 share only). FI-322 permit (valuation_step) is deliberately
// omitted: its fee floats with declared valuation and the live published
// total excludes it (no valuation basis on file for Ontario).
const ontario: JurisdictionRecord = {
  id: "ontario",
  name: "Ontario",
  county: "San Bernardino",
  region: "SoCal",
  postUrl: "/posts/ontario-adu-cost/",
  feeScheduleUrl:
    "https://content.ontarioca.gov/sites/default/files/2026-05/R2025-010%20Development%20Impact%20Fee%20Calculation%20and%20Updated%20Development%20Impact%20Fee%20Schedule.pdf",
  lastVerified: "19 Oct 2026",
  areaSchedules: [
    { id: "general-city", label: "General City" },
    { id: "ontario-ranch", label: "Ontario Ranch" },
  ],
  partialCategories: [
    {
      category: "school_fees",
      note: "Only the Chaffey HSD (9-12) share ($1.67/sq ft) is verified. The Ontario-Montclair ESD share ($3.57/sq ft) has no verified row; the dominant-case combined rate is $5.24/sq ft ($4,192 on 800 sq ft).",
    },
  ],
  feeLines: [
    {
      id: "FI-320",
      label: "Development Impact Fee — General City",
      category: "impact_fees",
      areaScheduleId: "general-city",
      status: "verified",
      calcType: "prorated_dwelling",
      rate: 37595,
      exemptAtOrBelowSqFt: 750,
      sb1117Eligible: true,
      sourceLabel: "City Council Resolution 2025-010",
      sourceUrl:
        "https://content.ontarioca.gov/sites/default/files/2026-05/R2025-010%20Development%20Impact%20Fee%20Calculation%20and%20Updated%20Development%20Impact%20Fee%20Schedule.pdf",
      lastVerified: "19 Oct 2026",
    },
    {
      id: "FI-321",
      label: "Development Impact Fee — Ontario Ranch",
      category: "impact_fees",
      areaScheduleId: "ontario-ranch",
      status: "verified",
      calcType: "prorated_dwelling",
      rate: 58576,
      exemptAtOrBelowSqFt: 750,
      sb1117Eligible: true,
      sourceLabel: "City Council Resolution 2025-089",
      sourceUrl:
        "https://content.ontarioca.gov/sites/default/files/2025-12/R2025-089%20Ontario%20Ranch%20Development%20Impact%20Fee%20Calculation%20and%20Updated%20Development%20Impact%20Fee%20Schedule.pdf",
      lastVerified: "19 Oct 2026",
    },
    {
      id: "FI-319",
      label: "School developer fee — Chaffey Joint Union HSD (9-12)",
      category: "school_fees",
      areaScheduleId: null,
      status: "verified",
      calcType: "per_sqft",
      rate: 1.67,
      exemptAtOrBelowSqFt: 499,
      sb1117Eligible: false,
      sourceLabel: "Chaffey Joint Union HSD Resolution 2026-33",
      sourceUrl:
        "https://files.smartsites.parentsquare.com/11290/developer_fee_justification_study.pdf",
      lastVerified: "19 Oct 2026",
    },
  ],
};

// --- San Jose ---------------------------------------------------------------
// FI-008 permit 0-750 ($3,291, to_verify) / FI-009 permit 751-1,200 ($5,103,
// verified) / FI-010 planning 13% ($336-$663, to_verify) / FI-011 planning
// 0-750 (no amount, to_verify) / FI-012 construction tax 3.96% (verified,
// valuation $175.92/sq ft) / FI-013 SJUSD school $5.38 (to_verify, min
// 751) / FI-014 parkland $1,700-$8,900 (to_verify, min 751). Ranged flat
// rows (FI-008/009/010/011) map to sqft_tiered per the adapter contract.
// FI-014 is a ranged flat ($1,700-$8,900 by MLS area); the engine has no
// range-aware flat type, so it is carried as flat with rate null and its
// published range in unverifiedRange. It is verifying, so the rate is
// never used; a verified ranged flat would need a range type first.
const sjScheduleUrl =
  "https://www.sanjoseca.gov/home/showpublisheddocument/121310";
const sanJose: JurisdictionRecord = {
  id: "san-jose",
  name: "San José",
  county: "Santa Clara",
  region: "Bay Area",
  postUrl: "/posts/san-jose-bay-area-adu-cost/",
  feeScheduleUrl: sjScheduleUrl,
  lastVerified: "3 Oct 2026",
  feeLines: [
    {
      id: "FI-008",
      label: "Building permit fee (0-750 sq ft)",
      category: "plan_check_permits",
      areaScheduleId: null,
      status: "verifying",
      calcType: "sqft_tiered",
      rate: null,
      tiers: [{ minSqFt: 0, maxSqFt: 750, flatAmount: 3291 }],
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "3 Oct 2026",
    },
    {
      id: "FI-009",
      label: "Building permit fee (751-1,200 sq ft)",
      category: "plan_check_permits",
      areaScheduleId: null,
      status: "verified",
      calcType: "sqft_tiered",
      rate: null,
      tiers: [{ minSqFt: 751, maxSqFt: 1200, flatAmount: 5103 }],
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "3 Oct 2026",
    },
    {
      id: "FI-010",
      label: "Citywide Planning Fee (13% of permit fee)",
      category: "planning_taxes",
      areaScheduleId: null,
      status: "verifying",
      calcType: "sqft_tiered",
      rate: null,
      tiers: [{ minSqFt: 751, maxSqFt: 1200, flatAmount: null }],
      unverifiedRange: [336, 663],
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "3 Oct 2026",
    },
    {
      id: "FI-011",
      label: "Citywide Planning Fee (0-750 sq ft)",
      category: "planning_taxes",
      areaScheduleId: null,
      status: "verifying",
      calcType: "sqft_tiered",
      rate: null,
      tiers: [{ minSqFt: 0, maxSqFt: 750, flatAmount: null }],
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "",
    },
    {
      id: "FI-012",
      label: "Construction tax (3.96%)",
      category: "planning_taxes",
      areaScheduleId: null,
      status: "verified",
      calcType: "valuation_percent",
      rate: 0.0396,
      valuationPerSqFt: 175.92,
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "3 Oct 2026",
    },
    {
      id: "FI-013",
      label: "School developer fee — San Jose USD",
      category: "school_fees",
      areaScheduleId: null,
      status: "verifying",
      calcType: "per_sqft",
      rate: 5.38,
      exemptAtOrBelowSqFt: 499,
      sb1117Eligible: false,
      // Exposure only: the Level I cap $5.38/sq ft x 800 sq ft. The row
      // is to_verify, so this is never summed into a total.
      unverifiedRange: [4304, 4304],
      sourceLabel: "SJUSD Resolution 2025-26",
      lastVerified: "3 Oct 2026",
    },
    {
      id: "FI-014",
      label: "Parkland fee",
      category: "impact_fees",
      areaScheduleId: null,
      status: "verifying",
      calcType: "flat",
      rate: null,
      exemptAtOrBelowSqFt: 750,
      sb1117Eligible: true,
      unverifiedRange: [1700, 8900],
      sourceLabel: "FY2026-27 fee schedule",
      sourceUrl: sjScheduleUrl,
      lastVerified: "3 Oct 2026",
    },
  ],
};

describe("getDefaultTaxYearRule", () => {
  it("uses 2026 before Jan 1, 2027", () => {
    assert.equal(getDefaultTaxYearRule("2026-12-31"), "2026");
  });
  it("switches to 2027_sb1117 on Jan 1, 2027", () => {
    assert.equal(getDefaultTaxYearRule("2027-01-01"), "2027_sb1117");
  });
});

describe("Ontario General City — live totals", () => {
  const calc = calculateJurisdictionFees(ontario, 800, 1600, "2026");

  it("matches the live /fees/ontario/ General City total ($20,134)", () => {
    assert.equal(calc.verifiedTotal, 20133.5);
    assert.equal(calc.effectiveAreaScheduleId, "general-city");
  });
  it("combines design allowance + verified fees for the quote benchmark", () => {
    const sync = buildSoftCostSyncSummary(calc, 163);
    assert.equal(sync.verifiedGovFees, 20133.5);
    assert.equal(sync.combinedPhase1Benchmark, 34133.5);
    assert.equal(sync.jurisdictionsCount, 163);
  });
  it("computes the SB 1117 saving on the excess 50 sq ft only", () => {
    assert.equal(calc.sb1117SavingsAtCurrentSize, 17622.66);
    assert.equal(calc.sb1117SavingsUnpublished, false);
  });
  it("computes the 750 sq ft cliff (750 -> 751)", () => {
    assert.equal(calc.cliffDeltaAt751, 17646.15);
  });
  it("reports 2/5 verified categories and the partial school share", () => {
    assert.deepEqual(calc.verifiedCategoryRatio, { verified: 2, total: 5 });
    assert.equal(calc.unverifiedCount, 0);
    assert.equal(calc.unverifiedExposureRange, null);
    assert.equal(calc.partialCategoryNotes.length, 1);
    assert.equal(calc.partialCategoryNotes[0].category, "school_fees");
  });
});

describe("Ontario Ranch — live totals", () => {
  const calc = calculateJurisdictionFees(
    ontario,
    800,
    1600,
    "2026",
    "ontario-ranch"
  );

  it("matches the live /fees/ontario/ Ontario Ranch total ($30,624)", () => {
    assert.equal(calc.verifiedTotal, 30624);
    assert.equal(calc.effectiveAreaScheduleId, "ontario-ranch");
  });
  it("computes the Ranch SB 1117 saving and cliff", () => {
    assert.equal(calc.sb1117SavingsAtCurrentSize, 27457.5);
    assert.equal(calc.cliffDeltaAt751, 27494.11);
  });
});

describe("Boundary sizes — 499 / 750 / 751", () => {
  it("Ontario 499 sq ft: school and impact both $0", () => {
    const calc = calculateJurisdictionFees(ontario, 499, 1600, "2026");
    assert.equal(calc.verifiedTotal, 0);
  });
  it("Ontario 750 sq ft: impact $0, school on the full 750", () => {
    const calc = calculateJurisdictionFees(ontario, 750, 1600, "2026");
    assert.equal(calc.verifiedTotal, 1252.5);
  });
  it("Ontario 751 sq ft: cliff fee appears, school on the full 751", () => {
    const calc = calculateJurisdictionFees(ontario, 751, 1600, "2026");
    assert.equal(calc.verifiedTotal, 18900.32);
  });
  it("Ontario 800 sq ft under the 2027 rule: DIF on the excess 50 only", () => {
    const calc = calculateJurisdictionFees(ontario, 800, 1600, "2027_sb1117");
    assert.equal(calc.verifiedTotal, 2510.84);
    assert.equal(calc.sb1117SavingsAtCurrentSize, null);
  });
});

describe("San José — live totals", () => {
  const calc = calculateJurisdictionFees(sanJose, 800, 1600, "2026");

  it("matches the live /fees/san-jose/ verified total ($10,676)", () => {
    assert.equal(calc.verifiedTotal, 10676.15);
  });
  it("counts only the 3 applicable verifying lines at 800 sq ft", () => {
    // FI-008 and FI-011 are the 0-750 tiers: their tier does not cover
    // 800 sq ft, so they are not_applicable_at_size and never counted.
    assert.equal(calc.unverifiedCount, 3);
    assert.deepEqual(calc.unverifiedExposureRange, [6340, 13867]);
  });
  it("reports 2/5 verified categories", () => {
    assert.deepEqual(calc.verifiedCategoryRatio, { verified: 2, total: 5 });
  });
  it("San José 499 sq ft: only the construction tax is verified", () => {
    const calc499 = calculateJurisdictionFees(sanJose, 499, 1600, "2026");
    assert.equal(calc499.verifiedTotal, 3476.25);
    // FI-008 and FI-011 are verifying at this size; FI-013 and FI-014
    // are $0 by law (school < 500, impact <= 750), not pending.
    assert.equal(calc499.unverifiedCount, 2);
    assert.equal(calc499.unverifiedExposureRange, null);
  });
  it("San José 750 sq ft: parkland is $0 by law, school is pending", () => {
    const calc750 = calculateJurisdictionFees(sanJose, 750, 1600, "2026");
    assert.equal(calc750.verifiedTotal, 5224.82);
    assert.equal(calc750.unverifiedCount, 3);
    assert.deepEqual(calc750.unverifiedExposureRange, [4304, 4304]);
  });
});

describe("valuation_step (Ontario permit FI-322 schedule)", () => {
  // FI-322: $1,288 + $7 per $1,000 of valuation over $100,000. The live
  // Ontario total excludes it (no valuation basis on file), so the math
  // is tested here with an explicit test basis, not as an Ontario fact.
  const line: FeeLineItem = {
    id: "FI-322",
    label: "Building permit fee",
    category: "plan_check_permits",
    areaScheduleId: null,
    status: "verified",
    calcType: "valuation_step",
    rate: 7,
    base: 1288,
    threshold: 100000,
    step: 1000,
    lastVerified: "19 Oct 2026",
  };

  it("computes base + rate x (valuation - threshold) / step", () => {
    const calc = calculateFeeLine(
      { ...line, valuationPerSqFt: 200 },
      800,
      "2026"
    );
    assert.equal(calc.amount, 1708);
  });
  it("returns no_valuation_basis instead of guessing a valuation", () => {
    const calc = calculateFeeLine(line, 800, "2026");
    assert.equal(calc.amount, null);
    assert.equal(calc.exemptionReason, "no_valuation_basis");
  });
  it("returns not_applicable_at_size below the schedule threshold", () => {
    const calc = calculateFeeLine(
      { ...line, valuationPerSqFt: 100 },
      800,
      "2026"
    );
    assert.equal(calc.amount, null);
    assert.equal(calc.exemptionReason, "not_applicable_at_size");
  });
});

describe("SB 1117 flat conversion", () => {
  const flatImpact: FeeLineItem = {
    id: "HAYWARD-FLAT",
    label: "Flat impact fee (test line)",
    category: "impact_fees",
    areaScheduleId: null,
    status: "verified",
    calcType: "flat",
    rate: 3379,
    exemptAtOrBelowSqFt: 750,
    sb1117Eligible: true,
    lastVerified: "19 Oct 2026",
  };

  it("unpublished basis: 2026 amount stands, 2027 is null", () => {
    const r26 = calculateFeeLine(
      { ...flatImpact, sb1117FlatBasis: "unpublished" },
      800,
      "2026"
    );
    const r27 = calculateFeeLine(
      { ...flatImpact, sb1117FlatBasis: "unpublished" },
      800,
      "2027_sb1117"
    );
    assert.equal(r26.amount, 3379);
    assert.equal(r27.amount, null);
    assert.equal(r27.exemptionReason, "sb1117_conversion_unpublished");
  });
  it("undefined basis behaves as unpublished (never a silent prorate)", () => {
    const r27 = calculateFeeLine(flatImpact, 800, "2027_sb1117");
    assert.equal(r27.amount, null);
    assert.equal(r27.exemptionReason, "sb1117_conversion_unpublished");
  });
  it("explicit prorate_excess basis prorates to the excess area", () => {
    const r27 = calculateFeeLine(
      { ...flatImpact, sb1117FlatBasis: "prorate_excess" },
      800,
      "2027_sb1117"
    );
    assert.equal(r27.amount, 105.59);
  });
});

describe("evaluateQuoteFlags — corrected Ontario example", () => {
  const calc = calculateJurisdictionFees(ontario, 800, 1600, "2026");
  const sync = buildSoftCostSyncSummary(calc, 163);
  const quote: QuoteDraft = {
    softCosts: { phase: "soft_costs", status: "allowance", amount: 15000 },
    phases: [
      { phase: "site_foundation", status: "included", amount: 38000 },
      { phase: "framing_structure", status: "included", amount: 48000 },
      { phase: "building_envelope", status: "included", amount: 42000 },
      { phase: "systems_interior", status: "included", amount: 147000 },
      { phase: "landscaping_hardscape", status: "excluded", amount: 13000 },
      { phase: "crane_transport", status: "not_listed", amount: 0 },
    ],
  };
  const benchmarks = {
    soft_costs: 32000,
    site_foundation: 38000,
    framing_structure: 48000,
    building_envelope: 42000,
    systems_interior: 147000,
    landscaping_hardscape: 13000,
    crane_transport: 0,
  };

  it("fires the four expected flags in severity order", () => {
    const flags = evaluateQuoteFlags(quote, sync, benchmarks, {
      jurisdictionPostUrl: "/posts/ontario-adu-cost/",
      sb1117ExplainerUrl: "/sb-1117/",
    });
    assert.deepEqual(
      flags.map(f => f.code),
      [
        "SC_BELOW_GOV_FEES",
        "SC_EXCLUDED_OR_ALLOWANCE",
        "PHASE_MISSING",
        "SC_CLIFF_WARNING",
      ]
    );
  });
  it("does not fire the unverified-gap flag when nothing is pending", () => {
    const flags = evaluateQuoteFlags(quote, sync, benchmarks);
    assert.equal(
      flags.some(f => f.code === "SC_UNVERIFIED_GAP"),
      false
    );
  });
});

describe("cross-check against feeCalc.ts on real fees.json", () => {
  const feeData = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../data/fees.json"),
      "utf8"
    )
  ) as FeeData;

  it("Ontario General City agrees with feeCalc within $1", () => {
    const feeCalcResult = calcJurisdiction(feeData, "ONTARIO", 800, {
      area: "General City",
      primarySqft: 1600,
      verifiedOnly: true,
    });
    const engine = calculateJurisdictionFees(ontario, 800, 1600, "2026");
    // feeCalc rounds each line to whole dollars (18,798 + 1,336 = 20,134);
    // the new engine keeps cents (20,133.50). The $0.50 gap is rounding.
    assert.equal(feeCalcResult.totalLow, 20134);
    assert.ok(Math.abs(engine.verifiedTotal - feeCalcResult.totalLow) <= 1);
    assert.equal(feeCalcResult.pendingCount, 0);
  });

  it("San José agrees with feeCalc within $1, pending range exact", () => {
    const feeCalcResult = calcJurisdiction(feeData, "SAN-JOSE", 800, {
      primarySqft: 1600,
      verifiedOnly: true,
    });
    const engine = calculateJurisdictionFees(sanJose, 800, 1600, "2026");
    assert.equal(feeCalcResult.totalLow, 10676);
    assert.ok(Math.abs(engine.verifiedTotal - feeCalcResult.totalLow) <= 1);
    assert.equal(feeCalcResult.pendingCount, 3);
    assert.equal(engine.unverifiedCount, 3);
    assert.equal(feeCalcResult.pendingLow, 6340);
    assert.equal(feeCalcResult.pendingHigh, 13867);
    assert.deepEqual(engine.unverifiedExposureRange, [6340, 13867]);
  });
});
