// Shared "last verified" parsing/formatting. fees.json last_verified mixes ISO
// ("2026-10-16") and human ("7 Oct 2026") formats — never string-sort dates
// from it; parse both formats first.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export const parseVerified = (s: string): number => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const human = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(s);
  if (human && MONTHS[human[2]] !== undefined)
    return Date.UTC(+human[3], MONTHS[human[2]], +human[1]);
  return 0;
};

const NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Display any stored value as "16 Oct 2026" regardless of stored format.
export const formatVerified = (s: string): string => {
  const t = parseVerified(s);
  if (!t) return s;
  const d = new Date(t);
  return `${d.getUTCDate()} ${NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
