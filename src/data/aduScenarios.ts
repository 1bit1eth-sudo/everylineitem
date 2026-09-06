/**
 * Single source for /compare/ scenario columns.
 * Figures match published posts on main — do not invent phase lines.
 */

export type PhaseId =
  | "soft"
  | "site"
  | "framing"
  | "envelope"
  | "systems"
  | "landscape";

export type PhaseDef = {
  id: PhaseId;
  label: string;
};

/** Standard six-phase ledger used across the series. */
export const PHASES: PhaseDef[] = [
  { id: "soft", label: "Soft costs (design, permits, plan check)" },
  { id: "site", label: "Site work + foundation" },
  { id: "framing", label: "Framing + structure" },
  { id: "envelope", label: "Building envelope" },
  { id: "systems", label: "Systems + interior" },
  { id: "landscape", label: "Landscaping & hardscape" },
];

export type ExtraPhase = {
  id: string;
  label: string;
  amount: number;
};

export type AduScenario = {
  id: string;
  label: string;
  shortLabel: string;
  sqFt: number;
  /** Published all-in total (authoritative). */
  total: number;
  /** Published $/sq ft (may be rounded, e.g. garage ~$422). */
  costPerSqFt: number;
  href: string;
  phases: Record<PhaseId, number>;
  /** Rows outside the six-phase ledger (e.g. modular crane). */
  extraPhases?: ExtraPhase[];
  note?: string;
};

export const ADU_SCENARIOS: AduScenario[] = [
  {
    id: "detached-800",
    label: "800 sq ft detached (LA County median)",
    shortLabel: "800 sq ft detached",
    sqFt: 800,
    total: 320_000,
    costPerSqFt: 400,
    href: "/posts/800-sq-ft-adu-cost-california/",
    phases: {
      soft: 32_000,
      site: 38_000,
      framing: 48_000,
      envelope: 42_000,
      systems: 147_000,
      landscape: 13_000,
    },
  },
  {
    id: "detached-400",
    label: "400 sq ft detached (LA County)",
    shortLabel: "400 sq ft detached",
    sqFt: 400,
    total: 215_000,
    costPerSqFt: 537,
    href: "/posts/400-sq-ft-adu-cost-california/",
    phases: {
      soft: 28_000,
      site: 26_000,
      framing: 26_000,
      envelope: 25_000,
      systems: 102_000,
      landscape: 8_000,
    },
  },
  {
    id: "garage-450",
    label: "Garage conversion ~450 sq ft",
    shortLabel: "Garage conversion ~450",
    sqFt: 450,
    total: 190_000,
    costPerSqFt: 422,
    href: "/posts/garage-conversion-adu-cost-california/",
    phases: {
      soft: 24_000,
      site: 14_000,
      framing: 22_000,
      envelope: 28_000,
      systems: 85_000,
      landscape: 17_000,
    },
    note: "Living area ~450 sq ft; landscaping includes parking replacement.",
  },
  {
    id: "modular-800",
    label: "Modular 800 sq ft (after crane/transport)",
    shortLabel: "Modular 800 sq ft",
    sqFt: 800,
    total: 288_000,
    costPerSqFt: 360,
    href: "/posts/modular-vs-site-built-adu-cost-california/",
    phases: {
      soft: 29_000,
      site: 36_000,
      framing: 32_000,
      envelope: 28_000,
      systems: 128_000,
      landscape: 13_000,
    },
    extraPhases: [
      {
        id: "crane",
        label: "Crane, transport & staging",
        amount: 22_000,
      },
    ],
    note: "Post adds crane/transport as an explicit seventh row; included so the total matches $288,000.",
  },
  {
    id: "coastal-800",
    label: "Coastal 800 sq ft (LA coastal band)",
    shortLabel: "Coastal 800",
    sqFt: 800,
    total: 380_000,
    costPerSqFt: 475,
    href: "/posts/coastal-vs-inland-adu-cost-california/",
    phases: {
      soft: 42_000,
      site: 48_000,
      framing: 56_000,
      envelope: 50_000,
      systems: 162_000,
      landscape: 22_000,
    },
  },
  {
    id: "inland-800",
    label: "Inland 800 sq ft (Inland Empire)",
    shortLabel: "Inland 800",
    sqFt: 800,
    total: 300_000,
    costPerSqFt: 375,
    href: "/posts/coastal-vs-inland-adu-cost-california/",
    phases: {
      soft: 26_000,
      site: 34_000,
      framing: 44_000,
      envelope: 38_000,
      systems: 145_000,
      landscape: 13_000,
    },
  },
];

export const DEFAULT_COMPARE = {
  a: "detached-800",
  b: "detached-400",
} as const;
