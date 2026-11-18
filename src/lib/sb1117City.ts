// ---------------------------------------------------------------------------
// City-specific context for /sb-1117/[slug]/: what SB 1117 leaves in place
// in this jurisdiction, and how its saving compares with nearby pages.
// Everything is computed from fees.json at build time (verified rows only);
// no new fee data or assumptions live here.
// ---------------------------------------------------------------------------

import {
  calcJurisdiction,
  categoryTotals,
  categoryLabel,
  type FeeData,
  type Jurisdiction,
} from "@/lib/feeCalc";
import {
  summarizeSB1117,
  realJurisdictions,
  hasVerifiedRows,
  type SB1117Summary,
} from "@/lib/sb1117Pages";

export const CONTEXT_SQFT = 1000;

export interface UnchangedPart {
  category: string;
  label: string;
  amount: number;
}

export interface SB1117CityContext {
  /** Verified total at 1,000 sq ft under 2026 rules (first area schedule). */
  total: number;
  /** Verified impact-fee amount inside that total. */
  impact: number;
  /** Categories SB 1117 does not touch, largest first (amount > 0). */
  unchanged: UnchangedPart[];
  unchangedSum: number;
  area: string | null;
  peers: {
    juris: Jurisdiction;
    savingsHigh: number;
    current: SB1117Summary["current"];
    futureCarried: SB1117Summary["futureCarried"];
    self: boolean;
  }[];
  peerScope: "county" | "region";
  /** 1-based position of this page among peers by saving (high end). */
  peerRank: number;
  peerTotal: number;
  /** True when this page ranks below the top 8 and is appended to the table. */
  selfAppended: boolean;
}

/** Same filter as the page's own index rule: a verified impact line that
 * charges something at one of the page sizes. */
function indexable(d: FeeData, id: string): SB1117Summary | null {
  if (!hasVerifiedRows(d, id)) return null;
  const s = summarizeSB1117(d, id, CONTEXT_SQFT);
  if (!s.hasImpactLines || s.current.high <= 0) return null;
  return s;
}

export function sb1117CityContext(
  d: FeeData,
  juris: Jurisdiction,
  detail: SB1117Summary
): SB1117CityContext {
  const area = detail.byArea.length > 0 ? detail.byArea[0].area : null;
  const r = calcJurisdiction(d, juris.juris_id, CONTEXT_SQFT, {
    verifiedOnly: true,
    area,
  });
  const ok = r.lines.filter(
    l => l.kind === "ok" && l.item.status === "verified"
  );
  const cats = categoryTotals({ ...r, lines: ok });
  const impact = cats
    .filter(c => c.category === "impact")
    .reduce((s, c) => s + c.low, 0);
  const unchanged = cats
    .filter(c => c.category !== "impact" && c.low > 0)
    .map(c => ({
      category: c.category,
      label: categoryLabel(c.category),
      amount: c.low,
    }))
    .sort((a, b) => b.amount - a.amount);
  const unchangedSum = unchanged.reduce((s, c) => s + c.amount, 0);

  const all = realJurisdictions(d);
  const pick = (f: (j: Jurisdiction) => boolean) =>
    all
      .filter(f)
      .map(j => {
        const s =
          j.juris_id === juris.juris_id ? detail : indexable(d, j.juris_id);
        return s
          ? {
              juris: j,
              savingsHigh: s.savings.high,
              current: s.current,
              futureCarried: s.futureCarried,
              self: j.juris_id === juris.juris_id,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  let peerScope: "county" | "region" = "county";
  let peers = pick(j => j.county === juris.county);
  if (peers.length < 3) {
    peerScope = "region";
    peers = pick(j => j.region === juris.region);
  }
  peers.sort(
    (a, b) =>
      b.savingsHigh - a.savingsHigh ||
      a.juris.name.localeCompare(b.juris.name, "en-US")
  );
  const peerRank = peers.findIndex(p => p.self) + 1;
  const peerTotal = peers.length;
  const selfAppended = peers.length > 8 && peerRank > 8;
  if (peers.length > 8) {
    peers = selfAppended
      ? [...peers.slice(0, 7), peers[peerRank - 1]]
      : peers.slice(0, 8);
  }

  return {
    total: impact + unchangedSum,
    impact,
    unchanged,
    unchangedSum,
    area,
    peers,
    peerScope,
    peerRank,
    peerTotal,
    selfAppended,
  };
}

export function usd0(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** One-sentence answer to "which fees does SB 1117 not change here?". */
export function unchangedSentence(name: string, c: SB1117CityContext): string {
  if (c.unchanged.length === 0)
    return `Every verified ${name} line we have at 1,000 sq ft is an impact fee, so all of it is covered by SB 1117. School, permit and utility fees still apply, but we have no verified figure for them here yet.`;
  const parts = c.unchanged
    .map(u => `${u.label.toLowerCase()} (${usd0(u.amount)})`)
    .join(", ");
  const share = c.total > 0 ? Math.round((c.unchangedSum / c.total) * 100) : 0;
  return `At 1,000 sq ft${c.area ? ` (${c.area} schedule)` : ""}, ${usd0(c.unchangedSum)} of ${name}'s ${usd0(c.total)} in verified fees — ${share}% — is outside SB 1117 and stays the same in 2027: ${parts}. Only the ${usd0(c.impact)} in impact fees is re-based.`;
}
