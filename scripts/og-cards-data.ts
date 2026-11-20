/**
 * Per-jurisdiction OG card data, computed with the same engine the pages
 * use — no new fee logic lives here. If a number looks wrong, fix
 * feeCalc.ts / sb1117Pages.ts, not this file.
 *
 * Consumed by scripts/generate-og-cards.mjs (bundled with esbuild, then
 * rendered to SVG and rasterized to 1200x630 PNG by sharp).
 *
 * Display rules (never present an unverified or derived number as a
 * published fee):
 * - Verified fee floor: sum of VERIFIED, computable fee lines at 800 sq ft
 *   (same computation as src/pages/fees/[slug].astro). Area jurisdictions
 *   show a min–max range across areas, never a sum.
 * - 750 sq ft cliff: verified impact fees at 751 sq ft (state law sets them
 *   to $0 at 750). $0 is shown only when verified impact lines exist and
 *   total $0; otherwise the label "Not verified" is shown.
 * - SB 1117 saving: summarizeSB1117 at 1,000 sq ft (same as the homepage).
 *   Flat fees that cannot be converted yet are carried at their 2026
 *   amount, so a $0 saving with unconvertible lines is labeled
 *   "Carried forward", not "$0".
 * - Thin pages (verified < 2 rows) still get a card; the floor sub-line
 *   states the verified row count so the total is not mistaken for a
 *   complete bill.
 */
import feesData from "../src/data/fees.json";
import {
  calcJurisdiction,
  jurisAreas,
  fmtUSD,
  type FeeData,
} from "../src/lib/feeCalc";
import { summarizeSB1117 } from "../src/lib/sb1117Pages";
import { parseVerified } from "../src/utils/formatVerified";

export interface OgCardStat {
  /** Big text: a dollar amount/range, or a label when no number is honest. */
  value: string;
  /** One short sub-line explaining the value. */
  sub: string;
}

export interface OgCardData {
  slug: string;
  name: string;
  floor: OgCardStat;
  cliff: OgCardStat;
  saving: OgCardStat;
  /** Newest last_verified across the jurisdiction's VERIFIED rows (ISO), or null. */
  verifiedISO: string | null;
  /** Verified rows < 2: the page is noindexed; the card says so in the floor sub-line. */
  thin: boolean;
}

const data = feesData as unknown as FeeData;
const SQFT = 800;

function moneyRange(low: number, high: number | null): string {
  const h = high ?? low;
  return h !== low ? `${fmtUSD(low)}–${fmtUSD(h)}` : fmtUSD(low);
}

export function computeOgCards(): OgCardData[] {
  const cards: OgCardData[] = [];
  for (const juris of data.jurisdictions.filter(
    j => j.juris_id !== "LA-BASE"
  )) {
    const id = juris.juris_id;
    const slug = id.toLowerCase();
    const verifiedRows = data.fee_items.filter(
      i => i.juris_id === id && i.status === "verified"
    );
    const thin = verifiedRows.length < 2;

    // Last verified — same definition as the page headers.
    const ts = verifiedRows.map(i => parseVerified(i.last_verified ?? ""));
    const verifiedISO = ts.length
      ? new Date(Math.max(...ts)).toISOString().slice(0, 10)
      : null;

    // Floor at 800 sq ft, verified computable lines only (mirror
    // src/pages/fees/[slug].astro). Area jurisdictions: range, never sum.
    const areas = jurisAreas(data, id);
    const isArea = areas.length > 0;
    const areaResults = isArea
      ? areas.map(a => ({
          area: a,
          result: calcJurisdiction(data, id, SQFT, { area: a }),
        }))
      : [
          {
            area: null as string | null,
            result: calcJurisdiction(data, id, SQFT),
          },
        ];
    const areaTotals = areaResults.map(({ result: r }) => {
      const vl = r.lines.filter(
        l => l.item.status === "verified" && l.kind !== "skipped"
      );
      return {
        low: vl.reduce((s, l) => s + l.low, 0),
        high: vl.reduce((s, l) => s + (l.high ?? l.low), 0),
      };
    });
    const floorLow = isArea
      ? Math.min(...areaTotals.map(t => t.low))
      : areaTotals[0].low;
    const floorHigh = isArea
      ? Math.max(...areaTotals.map(t => t.high))
      : areaTotals[0].high;
    const skippedVerified = new Set<string>();
    const computableIds = new Set<string>();
    for (const { result: r } of areaResults) {
      for (const l of r.lines) {
        if (l.item.status !== "verified") continue;
        if (l.kind === "skipped") skippedVerified.add(l.item.item_id);
        else computableIds.add(l.item.item_id);
      }
    }

    let floor: OgCardStat;
    if (verifiedRows.length === 0) {
      floor = { value: "Verifying", sub: "No verified fees yet" };
    } else if (computableIds.size === 0) {
      // Verified rates exist but no dollar amount is computable (no
      // valuation basis on file, e.g. Diamond Bar's permit lines).
      floor = { value: "Rates on file", sub: "Amounts need valuation" };
    } else {
      floor = {
        value:
          floorLow !== floorHigh
            ? moneyRange(floorLow, floorHigh)
            : fmtUSD(floorLow),
        sub: thin
          ? `800 sq ft · ${verifiedRows.length} verified row`
          : skippedVerified.size > 0
            ? "800 sq ft · partial — rates need valuation"
            : "800 sq ft · verified rows only",
      };
    }

    // 750 sq ft cliff: verified impact fees at 751 sq ft (mirror the fees
    // template). $0 is a real number only when verified impact lines exist.
    const cliffByArea = isArea
      ? areas.map(a => ({
          area: a,
          amount: calcJurisdiction(data, id, 751, {
            area: a,
            verifiedOnly: true,
          }).impactLow,
        }))
      : [];
    const cliffAmount = isArea
      ? Math.max(...cliffByArea.map(c => c.amount))
      : calcJurisdiction(data, id, 751, { verifiedOnly: true }).impactLow;
    const cliffLow = isArea
      ? Math.min(...cliffByArea.map(c => c.amount))
      : cliffAmount;
    const showCliff = cliffAmount > 0;
    const hasVerifiedImpact = data.fee_items.some(
      i => i.juris_id === id && i.category === "impact" && i.status === "verified"
    );
    let cliff: OgCardStat;
    if (showCliff) {
      cliff = {
        value:
          cliffLow !== cliffAmount
            ? moneyRange(cliffLow, cliffAmount)
            : fmtUSD(cliffAmount),
        sub: "at 751 sq ft · through Dec 31, 2026",
      };
    } else if (hasVerifiedImpact) {
      cliff = { value: "$0", sub: "verified · through Dec 31, 2026" };
    } else {
      cliff = { value: "Not verified", sub: "no verified impact fees" };
    }

    // SB 1117 saving at 1,000 sq ft (same as the homepage max-saving calc).
    const s = summarizeSB1117(data, id, 1000);
    let saving: OgCardStat;
    if (!s.hasImpactLines) {
      saving = { value: "Not verified", sub: "no verified impact fees" };
    } else if (s.savings.high > 0) {
      saving = {
        value:
          s.savings.low !== s.savings.high
            ? moneyRange(s.savings.low, s.savings.high)
            : fmtUSD(s.savings.high),
        sub: "at 1,000 sq ft · from Jan 1, 2027",
      };
    } else if (s.uncertain.high > 0) {
      // Flat fees are carried at their 2026 amount — the saving is not
      // $0, it is not yet published.
      saving = { value: "Carried forward", sub: "flat fees at 2026 amounts" };
    } else {
      saving = { value: "$0", sub: "no saving at 1,000 sq ft" };
    }

    cards.push({ slug, name: juris.name, floor, cliff, saving, verifiedISO, thin });
  }
  return cards;
}
