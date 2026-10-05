/**
 * Search-result title/description overrides for posts (head tags only).
 * On-page H1 and card text still use the frontmatter title/description.
 * Keep titles ~60 chars (including any suffix) and descriptions <= 155.
 */
export type PostSeo = { title: string; description: string };

export const POST_SEO: Record<string, PostSeo> = {
  "400-sq-ft-adu-cost-california": {
    title: "400 sq ft ADU Cost in California (2026) | Every Line Item",
    description:
      "A 400 sq ft detached ADU in LA County, modeled at $215,000 ($538/sq ft). Every phase, why fixed costs dominate, and when 400 still makes sense.",
  },
  "800-sq-ft-adu-cost-california": {
    title: "800 sq ft ADU Cost in California (2026) | Every Line Item",
    description:
      "An 800 sq ft detached ADU in LA County, priced phase by phase: $320,000 total. See where each dollar goes and why smaller is not cheaper.",
  },
  "adu-all-in-cost-california": {
    title: "California ADU All-In Cost (2026) | Every Line Item",
    description:
      "The $320,000 build is not what you spend. Add 12% contingency, construction loan interest, Prop 13 tax, and vacancy for a year-one all-in total.",
  },
  "adu-rent-payback-roi-california": {
    title: "ADU Rent Payback & ROI in California | Every Line Item",
    description:
      "The $320,000 ADU (~$381,000 all-in year one) against realistic LA County rents: simple payback, cash-on-cash, and what breaks the model.",
  },
  "adu-soft-costs-permits-california": {
    title: "ADU Soft Costs & Permit Fees in California | Every Line Item",
    description:
      "California ADU soft costs typically run $28,000–$40,000 before construction. Every design, engineering, plan check, and fee line, by jurisdiction type.",
  },
  "coastal-vs-inland-adu-cost-california": {
    title: "Coastal vs Inland ADU Cost in SoCal (2026) | Every Line Item",
    description:
      "Same 800 sq ft ADU plan, two bills: LA coastal near $380,000 ($475/sq ft) vs Inland Empire near $300,000 ($375/sq ft). What drives the swing.",
  },
  "garage-conversion-adu-cost-california": {
    title: "Garage Conversion ADU Cost in California | Every Line Item",
    description:
      "A 2-car garage conversion ADU in LA County (~450 sq ft) modeled at $190,000. See which phases shrink vs a new detached build, and which grow.",
  },
  "los-angeles-county-adu-cost": {
    title: "Los Angeles County ADU Cost (2026) | Every Line Item",
    description:
      "LA County ADU cost medians for 800, 400, and garage builds on one six-phase ledger: City of LA vs unincorporated, soft costs, and the 750 sq ft fee cliff.",
  },
  "san-diego-adu-cost": {
    title: "San Diego ADU Cost: 4 Cities Compared | Every Line Item",
    description:
      "An 800 sq ft detached ADU in San Diego priced phase by phase — $344,000. Plus why the same build costs $17,400 more in the city than in Encinitas.",
  },
  "san-jose-bay-area-adu-cost": {
    title: "San Jose ADU Cost 2026: Bay Area Fees | Every Line Item",
    description:
      "An 800 sq ft San Jose ADU priced phase by phase (about $400,000, our estimate), plus the fees the same plan owes in Palo Alto, Oakland, SF and the county.",
  },
  "modular-vs-site-built-adu-cost-california": {
    title: "Modular vs Site-Built ADU Cost in CA | Every Line Item",
    description:
      "Same 800 sq ft ADU, two methods: site-built $320,000 vs modular near $288,000 after crane and transport. Where each phase saves or grows.",
  },
};
