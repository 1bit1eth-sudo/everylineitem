/**
 * City fee profile: page-specific facts for /fees/[slug] and /sb-1117/[slug],
 * computed at build time from src/data/fees.json (verified rows only).
 *
 * Purpose (AdSense "low value" / indexing pass, 2026-11-17): every city page
 * gets text, numbers and links that belong to that city alone — its rank,
 * its county neighbours, where its money goes, its largest line, and the
 * documents behind it. Nothing here is hand-written per city and nothing is
 * estimated: every figure is the same verified math the fee table uses.
 */
import {
  calcJurisdiction,
  categoryTotals,
  categoryLabel,
  jurisStack,
  type FeeData,
  type FeeItem,
  type Jurisdiction,
} from "@/lib/feeCalc";

export const PROFILE_SQFT = 800;
/** Same ranking rule as /fee-index/: at least three verified line items. */
export const RANK_MIN_ITEMS = 3;
/** Sizes for the worked example. 750/751 show the state-law cliff. */
export const EXAMPLE_SIZES = [600, 750, 751, 1000, 1200] as const;

export interface PeerRow {
  jurisId: string;
  name: string;
  total: number;
  count: number;
  self: boolean;
}

export interface CityProfile {
  juris: Jurisdiction;
  area: string | null;
  total: number;
  count: number;
  rank: number | null;
  rankedOf: number;
  median: number;
  peers: PeerRow[];
  peerScope: "county" | "region";
  /** Peers in scope before the table is cut to 8 rows (includes this city). */
  peerCount: number;
  peerHigher: number;
  categories: {
    category: string;
    label: string;
    amount: number;
    share: number;
  }[];
  largest: { item: FeeItem; amount: number } | null;
  perSqftCount: number;
  flatCount: number;
  valuationCount: number;
  proratedCount: number;
  examples: { sqft: number; total: number; impact: number }[];
  sources: {
    url: string;
    note: string | null;
    lines: number;
    lastVerified: string | null;
  }[];
}

const real = (d: FeeData) =>
  d.jurisdictions.filter(j => j.juris_id !== "LA-BASE");

let stackCache: Map<string, ReturnType<typeof jurisStack>> | null = null;
function stacks(d: FeeData) {
  if (!stackCache) {
    stackCache = new Map(
      real(d).map(j => [j.juris_id, jurisStack(d, j.juris_id, PROFILE_SQFT)])
    );
  }
  return stackCache;
}

export function cityProfile(d: FeeData, jurisId: string): CityProfile | null {
  const juris = d.jurisdictions.find(j => j.juris_id === jurisId);
  if (!juris) return null;
  const all = stacks(d);
  const own = all.get(jurisId);
  if (!own || own.count === 0) return null;

  const ranked = [...all.values()]
    .filter(s => s.count >= RANK_MIN_ITEMS)
    .sort((a, b) => b.total - a.total);
  const rankIdx = ranked.findIndex(s => s.jurisId === jurisId);
  const totals = ranked.map(s => s.total).sort((a, b) => a - b);
  const median =
    totals.length === 0
      ? 0
      : totals.length % 2
        ? totals[(totals.length - 1) / 2]
        : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;

  const peersOf = (pick: (j: Jurisdiction) => boolean) =>
    real(d)
      .filter(pick)
      .map(j => ({ j, s: all.get(j.juris_id)! }))
      .filter(
        ({ j, s }) =>
          s && s.count > 0 && (s.total > 0 || j.juris_id === jurisId)
      )
      .map(({ j, s }) => ({
        jurisId: j.juris_id,
        name: j.name,
        total: s.total,
        count: s.count,
        self: j.juris_id === jurisId,
      }))
      .sort((a, b) => b.total - a.total);
  let peerScope: "county" | "region" = "county";
  let peers = peersOf(j => j.county === juris.county);
  if (peers.length < 3) {
    peerScope = "region";
    peers = peersOf(j => j.region === juris.region);
  }
  const peerCount = peers.length;
  const peerHigher = peers.filter(x => !x.self && x.total > own.total).length;
  // Keep the table short but always include this city.
  if (peers.length > 8) {
    const selfRow = peers.find(p => p.self);
    const top = peers.filter(p => !p.self).slice(0, 7);
    peers = [...top, ...(selfRow ? [selfRow] : [])].sort(
      (a, b) => b.total - a.total
    );
  }

  const area = own.area;
  const r = calcJurisdiction(d, jurisId, PROFILE_SQFT, {
    verifiedOnly: true,
    area,
  });
  const okLines = r.lines.filter(
    l => l.kind === "ok" && l.item.status === "verified"
  );
  const cats = categoryTotals({ ...r, lines: okLines });
  const catSum = cats.reduce((s, c) => s + c.low, 0);
  const categories = cats
    .filter(c => c.low > 0)
    .map(c => ({
      category: c.category,
      label: categoryLabel(c.category),
      amount: c.low,
      share: catSum > 0 ? c.low / catSum : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const largestLine = [...okLines].sort((a, b) => b.low - a.low)[0];

  const verifiedItems = d.fee_items.filter(
    i =>
      i.juris_id === jurisId &&
      i.status === "verified" &&
      (area == null || i.area == null || i.area === area)
  );
  const examples = EXAMPLE_SIZES.map(sqft => {
    const x = calcJurisdiction(d, jurisId, sqft, { verifiedOnly: true, area });
    const lines = x.lines.filter(
      l => l.kind === "ok" && l.item.status === "verified"
    );
    return {
      sqft,
      total: lines.reduce((s, l) => s + l.low, 0),
      impact: lines
        .filter(l => l.item.category === "impact")
        .reduce((s, l) => s + l.low, 0),
    };
  });

  const bySource = new Map<
    string,
    { note: string | null; lines: number; lastVerified: string | null }
  >();
  for (const i of verifiedItems) {
    if (!i.source_url || !/^https?:\/\//.test(i.source_url)) continue;
    const cur = bySource.get(i.source_url) ?? {
      note: i.source_note,
      lines: 0,
      lastVerified: i.last_verified,
    };
    cur.lines += 1;
    if (!cur.note && i.source_note) cur.note = i.source_note;
    bySource.set(i.source_url, cur);
  }

  return {
    juris,
    area,
    total: own.total,
    count: own.count,
    rank: rankIdx >= 0 ? rankIdx + 1 : null,
    rankedOf: ranked.length,
    median,
    peers,
    peerScope,
    peerCount,
    peerHigher,
    categories,
    largest: largestLine
      ? { item: largestLine.item, amount: largestLine.low }
      : null,
    perSqftCount: verifiedItems.filter(i => i.method === "per_sqft").length,
    flatCount: verifiedItems.filter(i => i.method === "flat").length,
    valuationCount: verifiedItems.filter(
      i => i.method === "pct_valuation" || i.method === "valuation_step"
    ).length,
    proratedCount: verifiedItems.filter(i => i.dwelling_base).length,
    examples,
    sources: [...bySource.entries()].map(([url, v]) => ({ url, ...v })),
  };
}

export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** One-paragraph comparison sentence, reused by the page section and the FAQ. */
export function compareSentence(p: CityProfile): string {
  const n = p.juris.name;
  if (p.total <= 0) {
    return `Every verified line we have for ${n} comes to $0 for an ${PROFILE_SQFT} sq ft ADU (see the table above for why), so ${n} is not ranked against other jurisdictions.`;
  }
  const base =
    p.rank != null
      ? `Among the ${p.rankedOf} California jurisdictions with at least ${RANK_MIN_ITEMS} verified fee lines, ${n} ranks #${p.rank} for verified government fees on an ${PROFILE_SQFT} sq ft ADU: ${usd(p.total)}, against a median of ${usd(p.median)}.`
      : `${n} has ${p.count} verified fee line${p.count === 1 ? "" : "s"} — fewer than the ${RANK_MIN_ITEMS} we require to rank a jurisdiction — so its ${usd(p.total)} total is a floor, not a full bill.`;
  const othersN = p.peerCount - 1;
  if (othersN <= 0) return base;
  const scope =
    p.peerScope === "county"
      ? `${p.juris.county} County`
      : `the ${p.juris.region} region`;
  const higher = p.peerHigher;
  return `${base} Within ${scope}, ${higher === 0 ? `it has the highest verified total of the ${othersN + 1} jurisdictions we track` : higher === othersN ? `it has the lowest verified total of the ${othersN + 1} jurisdictions we track` : `${higher} of the ${othersN} other jurisdictions we track have a higher verified total`}.`;
}

export function largestSentence(p: CityProfile): string | null {
  if (!p.largest || p.total <= 0) return null;
  const share =
    p.largest.amount /
    Math.max(
      1,
      p.categories.reduce((s, c) => s + c.amount, 0)
    );
  return `The largest single verified line in ${p.juris.name} is "${p.largest.item.fee_name}" (${categoryLabel(p.largest.item.category).toLowerCase()}) at ${usd(p.largest.amount)} for an ${PROFILE_SQFT} sq ft ADU — ${pct(share)} of the verified total.`;
}
