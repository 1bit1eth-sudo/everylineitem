import type { FeeData } from "./feeCalc";
import {
  summarizeSB1117,
  realJurisdictions,
  hasVerifiedRows,
} from "./sb1117Pages";

/**
 * Hub list orders, shared by the hub pages and the prev/next nav on detail
 * pages (content-loop device E: "same hub, in list order").
 *
 * The fee hub lists jurisdictions alphabetically by name, grouped by region
 * (regions in first-appearance order). The SB 1117 hub lists jurisdictions
 * with verified impact-fee rows, ranked by 1,000 sq ft savings (then
 * uncertainty, then current amount, then name). Both orders are reproduced
 * here so the detail pages navigate in exactly the hub's order.
 */

export function feeHubOrder(data: FeeData) {
  const jurisdictions = data.jurisdictions
    .filter(j => j.juris_id !== "LA-BASE")
    .sort((a, b) => a.name.localeCompare(b.name, "en-US"));

  const byRegion = new Map<string, typeof jurisdictions>();
  for (const j of jurisdictions) {
    const r = j.region || "California";
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r)!.push(j);
  }

  return [...byRegion.values()].flat();
}

export function sb1117HubOrder(data: FeeData) {
  const rows = realJurisdictions(data)
    .filter(j => hasVerifiedRows(data, j.juris_id))
    .map(j => {
      const s800 = summarizeSB1117(data, j.juris_id, 800);
      const s1000 = summarizeSB1117(data, j.juris_id, 1000);
      return { j, s800, s1000 };
    })
    .filter(r => r.s1000.hasImpactLines);

  const ranked = [...rows].sort(
    (a, b) =>
      b.s1000.savings.high - a.s1000.savings.high ||
      b.s1000.uncertain.high - a.s1000.uncertain.high ||
      b.s1000.current.high - a.s1000.current.high ||
      a.j.name.localeCompare(b.j.name, "en-US")
  );

  return ranked.map(r => r.j);
}
