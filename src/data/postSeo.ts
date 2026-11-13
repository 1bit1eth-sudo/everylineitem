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
  // 2026-11-12: search-result title <= 60 / description <= 160 for posts whose
  // fallback ("<frontmatter title> | Every Line Item") or frontmatter description
  // ran long. Head tags only; the H1, card text and body are unchanged.
  "3-adu-laws-january-2027": {
    title: "3 ADU Laws Taking Effect Jan 1, 2027",
    description:
      "SB 1117 kills the 750 sq ft impact-fee cliff, SB 1196 forces utility connection deadlines, and AB 956 allows two detached ADUs per lot.",
  },
  "750-sq-ft-cliff-explained": {
    title: "The 750 Sq Ft Cliff: Why 50 Sq Ft Can Cost $10,000",
    description:
      "California's most expensive 50 square feet: build an ADU at 749 sq ft and pay $0 in impact fees; build at 800 and owe thousands.",
  },
  "ab-956-two-adus-one-lot": {
    title: "AB 956: Two Detached ADUs Per Lot From Jan 1, 2027",
    description:
      "AB 956 (Ch. 791), signed Sep 29, 2026: from Jan 1, 2027, cities must approve up to two detached ADUs on a single-family lot. Checked against leginfo.",
  },
  "adu-contingency-guide": {
    title: "The $32,000 Line Item Nobody Quotes: ADU Contingency",
    description:
      "Contractor bids never include contingency — but 10–15% ($32,000–$48,000 on a $320,000 ADU) is the industry standard reserve held by the owner.",
  },
  "adu-cost-per-square-foot-california": {
    title: "ADU Cost Per Square Foot in California: Why It Misleads",
    description:
      "An 800 sq ft ADU at $400 per foot looks cheaper than a 400 sq ft ADU at $538 — until you see which costs don't scale.",
  },
  "adu-financing-compared-heloc-construction-loan": {
    title: "ADU Financing: HELOC vs Construction Loan vs Refi",
    description:
      "Four ways to fund a $320,000 ADU — HELOC, construction-to-permanent, cash-out refinance, and home equity loan — with rate ranges and timelines.",
  },
  "adu-permit-clocks-15-60-days": {
    title: "The ADU Permit Clocks: 15 Days, 60 Days, and the Fine Print",
    description:
      "Two clocks govern California ADU permits: 15 business days for completeness, 60 days for a decision. The fine print on cure lists, tolling, and the JADU gap.",
  },
  "adu-permit-timeline": {
    title: "How Long Does an ADU Permit Take? The Real Timeline",
    description:
      "State law says 60 days. Reality says plan for more. The ADU permit timeline phase by phase, with the 60-day, 15-day, and 30-day statutory clocks.",
  },
  "adu-school-fees-explained": {
    title: "ADU School Fees: Level 1, Level 2, and the 500 Sq Ft Rule",
    description:
      "Why school fees on the same 800 sq ft ADU range from $1,792 to $4,304 in California: who sets the rate, Level 1 vs Level 2, and the 500 sq ft rule.",
  },
  "adu-solar-property-tax-exclusion-ends-2027": {
    title: "ADU Solar's Property-Tax Exclusion Ends January 1, 2027",
    description:
      "California's solar property-tax exclusion ends January 1, 2027. What counts, what survives a sale, and the 2026 completion trap for ADU solar.",
  },
  "anaheim-adu-cost": {
    title: "Anaheim ADU Fees 2026: The Series' Highest Impact Fees",
    description:
      "Anaheim ADU fees: the steepest impact fees in the series, plus the only combined permit-plus-plan-check fee.",
  },
  "bay-area-adu-fees-ranked": {
    title: "Bay Area ADU Fees Ranked: Oakland, SF, Palo Alto, San Jose",
    description:
      "The same 800 sq ft ADU, four Bay Area fee philosophies: Palo Alto ~$303,000 (corrected), Oakland $322,000, San Francisco $325,000, San Jose ~$400,000.",
  },
  "beverly-hills-adu-cost": {
    title: "Beverly Hills ADU Cost 2026: $305,000 Floor",
    description:
      "An 800 sq ft detached ADU in Beverly Hills priced phase by phase: $305,000 floor, $0 water and wastewater capacity, a $1,416 covenant fee.",
  },
  "burbank-adu-cost": {
    title: "Burbank ADU Fees 2026: The $3,692 Permit and a Sewer Cliff",
    description:
      "Burbank ADU fees: a $3,692 permit (series high) and a 750 sq ft cliff on the sewer bill.",
  },
  "burlingame-adu-cost": {
    title: "Burlingame ADU Cost 2026: $309,000–$310,000 Floor",
    description:
      "An 800 sq ft detached ADU in Burlingame priced phase by phase: $309,000–$310,000 floor, with water and sewer capacity charged per square foot.",
  },
  "california-adu-cost-ranked-10-cities": {
    title: "10 California Cities Ranked by ADU Cost: A $12,000 Spread",
    description:
      "Same 800 sq ft ADU, ten California cities, $12,000 apart: the series ranking from Long Beach ($313,000) to San Francisco ($325,000).",
  },
  "california-adu-impact-fees-explained": {
    title: "California ADU Impact Fees and the 750 Sq Ft Rule",
    description:
      "ADU impact fees: $0 at 750 sq ft or less, prorated above it, and limited to the area above 750 for a first two ADUs in 2027. What real cities charge.",
  },
  "california-adu-laws-january-2027": {
    title: "California ADU Laws Changing January 1, 2027",
    description:
      "AB 956 doubles detached ADUs, SB 1117 collapses impact fees to a 50 sq ft basis, and SB 1196 targets utility energization delays. What each law actually does.",
  },
  "california-cities-waived-adu-fees-2026": {
    title: "Which California Cities Waived ADU Fees in 2026",
    description:
      "Salinas zeroed out development impact fees. Oakland exempts ADUs from impact fees entirely.",
  },
  "campbell-adu-cost": {
    title: "Campbell ADU Fees 2026: Two Districts, One $5.38 School Fee",
    description:
      "An 800 sq ft detached ADU in Campbell priced phase by phase — about $310,000 at schedule caps.",
  },
  "chico-adu-cost": {
    title: "Chico ADU Cost 2026: $308,000 Floor",
    description:
      "An 800 sq ft detached ADU in Chico priced phase by phase: $308,000 floor, a $5.38 school fee, a flat $1,460 ADU permit, and a $41.60 seismic surcharge.",
  },
  "chula-vista-adu-cost": {
    title: "Chula Vista ADU Fees 2026: The Flat-Rate Permit Experiment",
    description:
      "An 800 sq ft detached ADU in Chula Vista priced phase by phase: $308,000 floor, a flat $3,951 ADU permit, and 12 pre-approved SnapADU plans.",
  },
  "cities-sued-adu-permit-delays-palos-verdes-ruling": {
    title: "Cities Can Be Sued for ADU Permit Delays: Palos Verdes",
    description:
      "On 23 October 2026, a California appeals court revived a homeowner's damages claim over a three-year ADU permit delay.",
  },
  "concord-adu-cost": {
    title: "Concord ADU Cost 2026: $313,000–$316,000 Floor",
    description:
      "An 800 sq ft detached ADU in Concord priced phase by phase: $313,000–$316,000 floor, flat-band impact fees, and six free pre-approved plans.",
  },
  "corona-adu-cost": {
    title: "Corona ADU Cost 2026: $305,000 Floor, $0 Impact Fees",
    description:
      "An 800 sq ft detached ADU in Corona priced phase by phase — $305,000 floor, the lowest floor in this series so far.",
  },
  "do-you-need-separate-insurance-adu": {
    title: "Do You Need Separate Insurance for Your ADU?",
    description:
      "Homeowner endorsement, landlord policy, or builder's risk — which insurance your ADU actually needs, when, and what it costs.",
  },
  "downey-adu-cost": {
    title: "Downey ADU Fees 2026: $0 Impact Fees Under 750 Sq Ft",
    description:
      "An 800 sq ft detached ADU in Downey priced phase by phase: $311,000. Impact fees are waived under 750 sq ft; permits reach ~$4,972 on a $150,000 valuation.",
  },
  "encinitas-adu-cost": {
    title: "Encinitas ADU Cost 2026: $322,000 and a $20,663 Cliff",
    description:
      "800 sq ft detached ADU in Encinitas: ~$322,000 total. A 749 sq ft ADU pays $0 DIF; a 750 sq ft ADU pays $20,663. Phase-by-phase breakdown.",
  },
  "fontana-adu-cost": {
    title: "Fontana ADU Fees 2026: $20,563 and a 738 Sq Ft Loophole",
    description:
      "Fontana charges $20,563 per new single-family home in impact fees, but its free 738 sq ft ADU plan stays under the 750 sq ft cliff and pays $0.",
  },
  "free-adu-plans-california": {
    title: "Free ADU Plans: 7 California Cities With Free Drawings",
    description:
      "Seven California cities offer pre-approved ADU plans — from Chula Vista's 12 SnapADU designs to Pasadena's free city-drawn prototypes.",
  },
  "fremont-adu-cost": {
    title: "Fremont ADU Fees 2026: Zero DIF, $5,168 Sewer Line",
    description:
      "An 800 sq ft detached ADU in Fremont for $316,000 — zero city impact fees, a $5,168 sewer capacity charge, and a $4,304 school fee.",
  },
  "fullerton-adu-cost": {
    title: "Fullerton ADU Fees 2026: $1,223 Permit, Two School Districts",
    description:
      "Fullerton ADU fees: the cheapest permit in the series ($1,223) and a two-district school fee.",
  },
  "garden-grove-adu-cost": {
    title: "Garden Grove ADU Fees 2026: Two Cliffs and Free Plans",
    description:
      "Garden Grove ADU fees: two cliffs (500 sq ft schools, 750 sq ft impact fees) and four free plans.",
  },
  "grover-beach-adu-cost": {
    title: "Grover Beach ADU Cost 2026: $305,000 Floor",
    description:
      "An 800 sq ft detached ADU in Grover Beach priced phase by phase: $305,000 floor, a flat $2,984 permit and plan check, and a $0 water and sewer connection.",
  },
  "how-to-read-adu-bid": {
    title: "How to Read an ADU Bid: Four Buckets, One Honest Number",
    description:
      "Three ADU bids, three different numbers, none of them comparable — until you sort every line into four buckets: Included, Allowance, Excluded, Owner-paid.",
  },
  "how-to-read-city-fee-schedule": {
    title: "How to Read Your City's ADU Fee Schedule",
    description:
      "Every number on this site comes from a city fee schedule — a PDF most homeowners never open.",
  },
  "inland-empire-adu-cost-compared": {
    title: "Inland Empire ADU Fees: Riverside, Fontana, San Bernardino",
    description:
      "Three Inland Empire cities, 30 miles apart: Riverside's $1,006 permit, Fontana's $20,563 impact fee, and San Bernardino's plain-language cliff.",
  },
  "jadu-cost-california": {
    title: "JADU Cost in California 2026: The ADU With No Fees",
    description:
      "A Junior ADU is California's only housing type with no impact fees, no school fees, no utility connection charges, and no parking requirement.",
  },
  "jadu-vs-adu-vs-garage-conversion": {
    title: "JADU vs ADU vs Garage Conversion: The Cheapest Unit",
    description:
      "Detached ADU ($320,000), garage conversion ($190,000), or JADU (nearly every fee $0): cost, timeline, rent, and constraints in one decision table.",
  },
  "la-county-adu-cost-compared": {
    title: "LA County ADU Cost Compared 2026: Four Cities",
    description:
      "The same 800 sq ft detached ADU priced in Long Beach, Glendale, Burbank, and Torrance — $313,000 to $320,000.",
  },
  "laguna-beach-adu-cost": {
    title: "Laguna Beach ADU Cost 2026: $314,000, No Coastal Premium",
    description:
      "800 sq ft ADU in Laguna Beach: ~$314,000. No impact fees, $215/100 sq ft sewer, $2.05 school fee.",
  },
  "lakewood-adu-cost": {
    title: "Lakewood ADU Fees 2026: School Fee Depends on Your Street",
    description:
      "Lakewood spans four school districts: the same 800 sq ft ADU owes $2,376, $3,832, or $4,304 in school fees by parcel. Full phase-by-phase cost breakdown.",
  },
  "long-beach-adu-cost": {
    title: "Long Beach ADU Fees 2026: The Third Way on Impact Fees",
    description:
      "Long Beach ADU fees: ADU-specific reduced rates — neither a cliff nor an exemption.",
  },
  "los-altos-hills-adu-cost": {
    title: "Los Altos Hills ADU Cost 2026: $308,000",
    description:
      "An 800 sq ft detached ADU in Los Altos Hills priced phase by phase: $308,000, three impact fees at $0, a $5.38 school fee, and a $1,555 permit column.",
  },
  "moreno-valley-adu-cost": {
    title: "Moreno Valley ADU Cost 2026: $310,000 and a $0 TUMF",
    description:
      "An 800 sq ft detached ADU in Moreno Valley priced phase by phase: $310,000, $0 TUMF, a $3,746 permit package, and seven free pre-approved plans.",
  },
  "napa-adu-cost": {
    title: "Napa ADU Cost 2026: $325,000 and a $10,033 Sewer Charge",
    description:
      "An 800 sq ft detached ADU in Napa priced phase by phase — $325,000, the highest total in this series so far.",
  },
  "oceanside-adu-cost": {
    title: "Oceanside ADU Fees 2026: The $0 Exemption, Unconfirmed",
    description:
      "An 800 sq ft detached ADU in Oceanside for about $311,000 — a $5,378 permit from the FY 2026-27 schedule, and an unconfirmed $0 impact-fee waiver.",
  },
  "orange-county-adu-cost-compared": {
    title: "Orange County ADU Cost Compared 2026: Three Cities",
    description:
      "The same 800 sq ft detached ADU priced in Anaheim, Fullerton, and Garden Grove — $318,000 to $320,000.",
  },
  "oxnard-adu-cost": {
    title: "Oxnard ADU Fees 2026: Ventura County's Coastal Fee Profile",
    description:
      "An 800 sq ft detached ADU in Oxnard priced phase by phase: $308,000 floor, the standard 750 sq ft cliff, and a $4,136 school fee split across two districts.",
  },
  "palo-alto-adu-cost": {
    title: "Palo Alto ADU Fees 2026: The $18,090 Question at 750 Sq Ft",
    description:
      "An 800 sq ft detached ADU in Palo Alto priced phase by phase — about $313,000, level with the lowest published total in the series.",
  },
  "pasadena-adu-cost": {
    title: "Pasadena ADU Fees 2026: $0 Impact Fees, $2.24 School Fee",
    description:
      "An 800 sq ft detached ADU in Pasadena priced phase by phase: about $299,000, $0 impact fees up to 900 sq ft, and a series-low $2.24/sq ft school fee.",
  },
  "permit-pricing-models": {
    title: "How Cities Price ADU Permits: Valuation, Flat, Per Sq Ft",
    description:
      "Three ADU permit pricing models: valuation-based (Pasadena, Campbell), flat-fee (Fontana $3,195, Chula Vista $3,951), and per-sq-ft (Oceanside $5,378).",
  },
  "prefab-adu-brands-compared-california": {
    title: "Prefab ADU Brands Compared 2026: Two Publish Prices",
    description:
      "Five prefab ADU brands, one 800 sq ft question. Abodu and Villa Homes publish real numbers; Boxabl, Dvele, and Mighty Buildings don't.",
  },
  "redlands-adu-cost": {
    title: "Redlands ADU Cost 2026: $309,000 Floor",
    description:
      "An 800 sq ft detached ADU in Redlands priced phase by phase: $309,000 floor, with every impact fee a per-square-foot line from a single ordinance.",
  },
  "riverside-adu-cost": {
    title: "Riverside ADU Cost 2026: $309,000, Cheapest Permit",
    description:
      "800 sq ft detached ADU in Riverside: $309,000 total, $1,006 permit (series low). Phase-by-phase breakdown.",
  },
  "riverside-county-adu-permit-cost": {
    title: "Riverside County ADU Permit Cost: $6,472 Deposit",
    description:
      "Unincorporated Riverside County ADU permits: a $6,472.45 deposit (not the final cost), $0 county impact fees, and four free pre-approved plans.",
  },
  "sacramento-adu-cost": {
    title: "Sacramento ADU Fees 2026: Crossing 750 Costs $5,347",
    description:
      "Sacramento ADU fees: crossing 750 sq ft costs $5,347 in impact fees.",
  },
  "salinas-adu-cost": {
    title: "Salinas ADU Fees 2026: The First City With Zero Impact Fees",
    description:
      "Salinas charges $0 in development and traffic impact fees on ADUs — at any size. The 750 sq ft cliff doesn't apply because there's no cliff to fall off.",
  },
  "san-bernardino-adu-cost": {
    title: "San Bernardino ADU Fees 2026: The Clearest 750 Sq Ft Cliff",
    description:
      "An 800 sq ft detached ADU in San Bernardino priced phase by phase: $316,000 floor, a pro-rata impact-fee formula in §19.04.030, and $4,304 school fees.",
  },
  "san-diego-county-adu-fees-compared": {
    title: "San Diego County ADU Fees Compared: $308K to $344K",
    description:
      "The same 800 sq ft ADU in Chula Vista ($308,000), Oceanside ($311,000), and the City of San Diego ($344,000): a $36,000 spread in one county.",
  },
  "san-francisco-adu-cost": {
    title: "San Francisco ADU Fees 2026: No 750 Sq Ft Cliff",
    description:
      "San Francisco ADU fees: why the 750 sq ft impact-fee cliff barely exists here.",
  },
  "san-mateo-county-adu-cost": {
    title: "San Mateo County ADU Cost 2026: $314,637 Floor",
    description:
      "800 sq ft detached ADU in unincorporated San Mateo County: $314,637 floor built from a full county permit stack, a fire review fee, and a $4,304 school fee.",
  },
  "santa-barbara-adu-cost": {
    title: "Santa Barbara ADU Cost 2026: $327,000, Priciest Permit",
    description:
      "800 sq ft detached ADU in Santa Barbara: ~$327,000 total. Permit + plan check ~$22,566 — the series high. No city impact fees. Phase-by-phase breakdown.",
  },
  "santa-clara-adu-cost": {
    title: "Santa Clara ADU Cost 2026: $313,000",
    description:
      "An 800 sq ft detached ADU in Santa Clara priced phase by phase: $313,000, an itemised permit schedule, $0 water and electric charges, no impact fees.",
  },
  "santa-maria-adu-cost": {
    title: "Santa Maria ADU Fees 2026: The Least Transparent Schedule",
    description:
      "Santa Maria ADU fees: the boom town with the least transparent fee schedule in the series.",
  },
  "santa-monica-adu-cost": {
    title: "Santa Monica ADU Fees 2026: The Coast Is Not Cheap",
    description:
      "An 800 sq ft detached ADU in Santa Monica for $309,000 — $0 impact fees for all ADU sizes, a $3,669 permit, and a $3,368 school fee.",
  },
  "santa-rosa-adu-cost": {
    title: "Santa Rosa ADU Cost 2026: $320,000, Fire-Era Discount",
    description:
      "800 sq ft ADU in Santa Rosa: ~$320,000. 25% impact-fee cut; water/sewer $8,230 exceeds DIF.",
  },
  "sb-1117-kills-750-sq-ft-cliff": {
    title: "On Jan 1, 2027, California Kills the 750 Sq Ft Cliff",
    description:
      "SB 1117, signed Sept 29, 2026, rewrites the ADU impact-fee rule: from Jan 1, 2027, cities may charge fees only on square footage above 750 — not the whole unit.",
  },
  "sb-1117-wait-or-permit-now": {
    title: "SB 1117: Should You Wait Until January to Permit Your ADU?",
    description:
      "From January 1, 2027, impact fees on the first two ADUs on a lot apply only to the area above 750 sq ft.",
  },
  "sb-1196-utility-hookup-backlog": {
    title: "SB 1196 and the ADU Utility Connection Backlog",
    description:
      "California ADU owners wait up to 9–12 months after construction for the utility hookup — a finished apartment with no power.",
  },
  "school-fee-gap-pasadena-campbell": {
    title: "The $2,512 School Fee Gap: Pasadena vs Campbell",
    description:
      "Same 800 sq ft ADU, $2,512 difference in school fees — from school district boundaries alone.",
  },
  "torrance-adu-cost": {
    title: "Torrance ADU Cost 2026: $317,000, Flat-Rate Impact Fee",
    description:
      "An 800 sq ft detached ADU in Torrance priced phase by phase: $317,000, the series' first flat-rate ADU impact fee ($2,243.47), and no ADU sewer capacity charge.",
  },
  "upland-adu-cost": {
    title: "Upland ADU Cost 2026: $308,000 Floor",
    description:
      "An 800 sq ft detached ADU in Upland priced phase by phase: $308,000 floor. The Parks DIF at $4.80 per square foot is 61% of all per-square-foot lines.",
  },
  "us-adu-fee-shockers": {
    title: "5 U.S. Cities Where ADU Fees Break the Chart",
    description:
      "From a $59,854 one-square-foot fee cliff in Maryland to a $60 building permit in Wyoming: five ADU fee findings from our 148-city national dataset.",
  },
  "vallejo-adu-cost": {
    title: "Vallejo ADU Cost 2026: $307,000 Floor",
    description:
      "An 800 sq ft detached ADU in Vallejo priced phase by phase: $307,000 floor, led by a $2,865 sanitary sewer capacity charge from the wastewater district.",
  },
  "watsonville-adu-cost": {
    title: "Watsonville ADU Cost 2026: $308,000 Floor",
    description:
      "An 800 sq ft detached ADU in Watsonville priced phase by phase: $308,000 floor, three $0 impact fees, a $3,655 building permit, and $2,448.85 plan check.",
  },
  "will-an-adu-raise-my-property-tax-california": {
    title: "Will an ADU Raise My Property Tax? (Prop 13, Explained)",
    description:
      "Building an ADU triggers a property tax reassessment — but only on the new construction, not your whole house.",
  },
  // 2026-11-13 [traffic edition, work 7]: scheduled posts (11/13-12/24) whose
  // fallback title or frontmatter description would exceed 60 / 160 on publish.
  // Head tags only; H1, card text, frontmatter and body are unchanged.
  "adu-fire-sprinklers-cost-rules": {
    title: "ADU Fire Sprinklers in California: Rules and Cost",
    description:
      "The two-question sprinkler test for California ADUs: is it new construction, and is the main home sprinklered? CAL FIRE rules and NFPA 13D cost ranges.",
  },
  "sb-1117-countdown-48-days": {
    title: "48 Days Until California Kills the 750 Sq Ft Cliff",
    description:
      "SB 1117 rewrites the ADU impact-fee rule on January 1, 2027, 48 days out. A recap of the 750 sq ft cliff, the savings table, and what 48 days means.",
  },
  "lancaster-adu-cost": {
    title: "Lancaster ADU Fees 2026: Permit Fees Not Published",
    description:
      "An 800 sq ft detached ADU in Lancaster, phase by phase: $305,000 floor. The permit valuation table isn't public and the DIF table is from 2021.",
  },
  "adu-solar-title-24-explained": {
    title: "Do ADUs Need Solar in California? Title 24, Explained",
    description:
      "When Title 24 requires solar on a California ADU (new detached vs conversion vs JADU), the 1.8 kW and solar-access exemptions, and what installers charge.",
  },
  "adu-permit-fees-ranked": {
    title: "ADU Permit Fees Ranked: $1,006 to $19,200, Same 800 Sq Ft",
    description:
      "Every building-permit and plan-check figure we have published for an 800 sq ft detached ADU, ranked: Riverside's $1,006 to Oakland's $12,800–$19,200.",
  },
  "santa-ana-adu-cost": {
    title: "Santa Ana ADU Fees 2026: 'Call the Permit Counter'",
    description:
      "An 800 sq ft detached ADU in Santa Ana, phase by phase: $308,000. The official FAQ answers permit cost with a phone number; the school fee is $4,304.",
  },
  "adu-setbacks-lot-coverage": {
    title: "ADU Setbacks and Lot Coverage in California",
    description:
      "California caps ADU side and rear setbacks at 4 feet (Gov. Code §66321(b)(3)), but lot coverage, FAR, and open space rules still apply. How they interact.",
  },
  "sb-1117-explained-plain-english": {
    title: "What SB 1117 Actually Says (Plain English) | Every Line Item",
    description:
      "SB 1117 (Chapter 809), effective Jan 1, 2027: impact fees on the first two ADUs per lot apply only to livable space above 750 sq ft. What it covers.",
  },
  "westminster-adu-cost": {
    title: "Westminster ADU Fees 2026: New Fee Schedule, Unverifiable",
    description:
      "An 800 sq ft detached ADU in Westminster, phase by phase: $306,802* floor. The new schedule isn't verifiable online, so key lines say 'verify with city.'",
  },
  "adu-parking-rules-2026": {
    title: "ADU Parking Rules in 2026: When You Don't Need a Space",
    description:
      "California bars ADU parking requirements in five cases (Gov. Code §66314(d)(10)-(11)) and caps it at one space per ADU otherwise. The exemptions and traps.",
  },
  "california-adu-cost-ranked-20-cities": {
    title: "20 California Cities Ranked by Total ADU Cost",
    description:
      "One identical 800 sq ft ADU in 20 California cities: firm totals from Oceanside ($311,000) to San Francisco ($325,000), with San Diego at $344,000.",
  },
  "ontario-adu-cost": {
    title: "Ontario ADU Fees 2026: Inland Empire's Next Data Point",
    description:
      "An 800 sq ft detached ADU in Ontario, phase by phase: $328,000. DIF: $37,595 per dwelling (General City) or $58,576 (Ontario Ranch), prorated for ADUs.",
  },
  "adu-owner-occupancy-rules": {
    title: "ADU Owner-Occupancy Rules: Do You Have to Live There?",
    description:
      "For standard California ADUs, no: state law bars owner-occupancy requirements. JADUs are the exception, limited to JADUs sharing a bathroom with the home.",
  },
  "sb-1117-should-you-rush-permit": {
    title: "36 Days to SB 1117: Rush Your Permit Before Jan 1?",
    description:
      "SB 1117 takes effect Jan 1, 2027. If your city has a steep 750 sq ft impact-fee cliff, waiting for January's marginal rates could save you five figures.",
  },
  "alhambra-adu-cost": {
    title: "Alhambra ADU Fees 2026: San Gabriel Valley's Fee Profile",
    description:
      "An 800 sq ft detached ADU in Alhambra, phase by phase: $316,000. No DIF at all, a $2,000 New Construction Tax, and a $448 vs $7,222 water-meter step-up.",
  },
  "hoa-adu-rules-california": {
    title: "HOAs and ADUs: What Your HOA Can and Can't Block in 2026",
    description:
      "California law makes HOA bans on ADUs void and unenforceable (Civil Code 4751). What your HOA can still do (reasonable design rules) and what it can't.",
  },
  "adu-school-fees-ranked-california": {
    title: "California ADU School Fees Ranked: $1,792 to $4,304",
    description:
      "Every school district fee we have published for an 800 sq ft ADU, ranked: Pasadena's $1,792 to Campbell's $4,304, set by district lines, not city limits.",
  },
  "december-2026-fee-reverification": {
    title: "December 2026 ADU Fee Re-verification: 23 Cities",
    description:
      "Our December 2026 re-verification pass: 23 city fee schedules re-checked against October snapshots and school-fee resolutions re-confirmed. In progress.",
  },
  "adu-appraised-value": {
    title: "Does an ADU Raise Your Home's Appraised Value?",
    description:
      "Appraisers use three approaches: sales comparison, income, and cost. How each one treats an ADU, and why construction cost is not appraised value.",
  },
  "west-covina-adu-cost": {
    title: "West Covina ADU Fees 2026: School Fee Depends on Address",
    description:
      "An 800 sq ft detached ADU in West Covina, phase by phase: $314,000. Three school districts: your school fee is $3,064 to $4,136, set by your address.",
  },
  "selling-house-with-adu": {
    title: "Selling a House With an ADU: What Changes | Every Line Item",
    description:
      "Disclosure rules, the permitted-vs-unpermitted value gap, how a two-ADU lot (AB 956) markets, and who buys ADU homes. A companion to our appraisal guide.",
  },
  "adu-soft-costs-ranked": {
    title: "ADU Soft Costs Ranked: 26 California Cities",
    description:
      "Permits, plan check, school, impact, and utility fees for an 800 sq ft ADU across 26 California cities, from Lancaster's $3,000 to Ontario's $26,003.",
  },
  "sb-1117-final-checklist": {
    title: "25 Days to SB 1117: The Final Checklist | Every Line Item",
    description:
      "SB 1117 takes effect January 1, 2027. The checklist: confirm your city's marginal-rate table, lock your school-fee number, and start the utility timeline.",
  },
  "estimate-adu-rent": {
    title: "How to Estimate Your ADU's Rent (Before You Build)",
    description:
      "Rent comps for ADUs, not apartments: sampling Craigslist and Zillow, adjusting for utilities and parking, and the 1% rule check. A worked example.",
  },
  "1000-sq-ft-adu-cost-california": {
    title: "1,000 Sq Ft ADU Cost in California (2026)",
    description:
      "A 1,000 sq ft detached ADU in California runs roughly $390,000–$420,000 in 2026, about $392,000 on the LA County site where 800 sq ft runs $320,000.",
  },
  "encinitas-impact-fees-july-2026": {
    title: "Encinitas Impact Fees Since July 20, 2026: 800 Sq Ft ADU",
    description:
      "Resolution 2026-34 set per-square-foot impact fees in Encinitas from July 20, 2026. Under 750 sq ft pays $0; 800 sq ft owes $16,464 plus 5% admin, or more.",
  },
  "milpitas-building-fees-november-2026": {
    title: "Milpitas ADU Building Fees, Effective November 2, 2026",
    description:
      "Milpitas's adopted fees (effective Nov 2, 2026) price ADU plan review and inspection on a tiered table, with an 800 sq ft worked total of $4,584.80.",
  },
  "hayward-adu-fees-fy2027": {
    title: "Hayward FY2027 ADU Fees: Park $3,379, Sewer $5,825",
    description:
      "Hayward's adopted FY2026-27 fee schedule (from July 1, 2026): park impact fee $3,812 to $3,379, sewer connection $5,295 to $5,825, ADU review fee $158.",
  },
  "can-you-sell-adu-separately-ab-1033": {
    title: "Can You Sell an ADU Separately? AB 1033 Explained",
    description:
      "AB 1033 lets California cities opt in to separate ADU sales: only as condominiums, with every lienholder's consent, and only where an ordinance is adopted.",
  },
  "adu-jadu-occupancy-30-day-rental-rule": {
    title: "ADU and JADU Occupancy Rules: What the Statute Actually Says",
    description:
      "California ADU and JADU occupancy rules from the statute text: AB 976, AB 1154's limit on JADU owner-occupancy, and the 30-day rental floor for both.",
  },
  "adu-utility-connection-capacity-fees-california": {
    title: "ADU Utility Connection and Capacity Fees in California",
    description:
      "Connection and capacity charges aren't impact fees, so SB 1117 doesn't govern them. Gov. Code section 66311.5 sets a separate test for these charges.",
  },
  "adu-preapproved-plans-california": {
    title: "Pre-Approved ADU Plans in California: What They Save",
    description:
      "San José, Oakland, and Pasadena pre-approved ADU plan programs, checked against the cities' own pages, and the site work no pre-approved plan removes.",
  },
  "calhfa-adu-grant-program-status": {
    title: "The CalHFA $40,000 ADU Grant Is Closed: What to Watch",
    description:
      "California's $40,000 ADU grant is not open: CalHFA's latest round was fully allocated Dec 28, 2023, and no new round was posted as of Nov 4, 2026.",
  },
  "redlands-adu-fees": {
    title: "Redlands ADU Fees 2026: One Square Foot Costs $6,563",
    description:
      "Redlands charges ADU impact fees per square foot — so square foot 751 triggers $6,563 and an 800 sq ft ADU owes $6,991. The full fee autopsy, sourced.",
  },
};
