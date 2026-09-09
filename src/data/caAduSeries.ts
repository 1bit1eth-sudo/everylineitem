/**
 * Shared California ADU series nav — single source so posts cannot drift.
 * Labels/prices match published English copy on main.
 */

export type CaAduSeriesItem = {
  /** Content collection id / slug (filename without extension). */
  slug: string;
  href: string;
  label: string;
  /** Trailing meta, e.g. "$320,000 · $400/sq ft". Omit for posts without prices. */
  meta?: string;
};

export type CaAduSeriesGroup = {
  heading: string;
  items: CaAduSeriesItem[];
};

export const CA_ADU_SERIES_ID = "ca-adu" as const;

export const CA_ADU_SERIES_INTRO =
  "Every build below uses the same six-phase ledger, so you can compare any two directly.";

export const CA_ADU_SERIES_GROUPS: CaAduSeriesGroup[] = [
  {
    heading: "New construction",
    items: [
      {
        slug: "800-sq-ft-adu-cost-california",
        href: "/posts/800-sq-ft-adu-cost-california/",
        label: "800 sq ft detached",
        meta: "$320,000 · $400/sq ft",
      },
      {
        slug: "400-sq-ft-adu-cost-california",
        href: "/posts/400-sq-ft-adu-cost-california/",
        label: "400 sq ft detached",
        meta: "$215,000 · $537/sq ft",
      },
      {
        slug: "garage-conversion-adu-cost-california",
        href: "/posts/garage-conversion-adu-cost-california/",
        label: "Garage conversion, ~450 sq ft",
        meta: "$190,000 · $422/sq ft",
      },
    ],
  },
  {
    heading: "Cost drivers",
    items: [
      {
        slug: "adu-soft-costs-permits-california",
        href: "/posts/adu-soft-costs-permits-california/",
        label: "Soft costs: permits, design, plan check",
      },
      {
        slug: "modular-vs-site-built-adu-cost-california",
        href: "/posts/modular-vs-site-built-adu-cost-california/",
        label: "Modular vs site-built",
      },
      {
        slug: "coastal-vs-inland-adu-cost-california",
        href: "/posts/coastal-vs-inland-adu-cost-california/",
        label: "Coastal vs inland",
      },
    ],
  },
  {
    heading: "Ownership",
    items: [
      {
        slug: "adu-all-in-cost-california",
        href: "/posts/adu-all-in-cost-california/",
        label: "All-in cost, year one",
      },
      {
        slug: "adu-rent-payback-roi-california",
        href: "/posts/adu-rent-payback-roi-california/",
        label: "Rent payback and ROI",
      },
    ],
  },
];
