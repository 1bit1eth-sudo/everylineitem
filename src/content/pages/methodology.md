---
title: Methodology
description: How every figure on this site is built, which sources are used, and what the known limitations are.
---

Every cost figure on this site is a **modeled median** built from public data. It is not a quote, and it is not an average of quotes we received. This page explains exactly how the numbers are produced.

## The unit of analysis is one specific scenario

We never publish a range as a headline. Each post models one defined build: a fixed square footage, a fixed jurisdiction, a fixed construction type, a fixed finish grade, and a stated site condition.

That is what makes the number checkable. A range cannot be wrong. A specific scenario can.

## The six-phase ledger

Every build is priced into the same six phases, in the same order, regardless of building type or region.

| Phase | Contents |
| --- | --- |
| Soft costs | Design, engineering, building permit, plan check, impact and connection fees |
| Site work + foundation | Excavation, grading, footings, slab or stem wall, sewer lateral, utility trenching |
| Framing + structure | Lumber package, framing labor, trusses, sheathing |
| Building envelope | Roofing, windows, exterior doors, siding, weather barrier |
| Systems + interior | Electrical, plumbing, HVAC, insulation, drywall, flooring, paint, trim, kitchen, bath |
| Landscaping + hardscape | Paths, stoops, planting, sod, finish grading |

Holding this schema fixed is the single most important methodological decision on the site. It is what makes cross-project comparison possible.

## Sources

### Primary — regulatory and permit records

- [California HCD — Accessory Dwelling Units](https://www.hcd.ca.gov/building-standards/adu) — the state's ADU program page
- [California HCD ADU Handbook](https://www.hcd.ca.gov/building-standards/adu/handbook) — statewide rules, size limits, fee exemptions. HCD added an Addendum in December 2025 covering changes to State ADU Law effective 1 January 2026
- [California Government Code §66311.5](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=13&division=1.&lawCode=GOV&part=&title=7.) — impact-fee limits for ADUs and JADUs (including the 750 sq ft threshold)
- [LA County EPIC-LA permit portal](https://epicla.lacounty.gov/) — declared construction valuations, unincorporated county and contract cities
- [LA County Building & Safety permit information](https://permits.lacounty.gov/permits/building-and-safety/) — permit types, plan check, fee process
- [LA County Open Data — EPIC-LA Permit Finder](https://data.lacounty.gov/datasets/epic-la-permit-finder) — permit record dataset
- [LADBS online building records](https://www.ladbs.org/services/check-status/online-building-records) — City of Los Angeles
- [LADBS Permit & Inspection Report](https://www.ladbsservices2.lacity.org/onlineservices/?service=plr) — search permits by address
- [ZIMAS](https://zimas.lacity.org/) — City of Los Angeles zoning and parcel constraints

### Secondary — cost structure and benchmarks

- [NAHB Cost of Construction Survey](https://eyeonhousing.org/2025/01/cost-of-constructing-a-home-in-2024/) — phase-level cost shares. Construction costs accounted for 64.4% of the average new home sale price in the 2024 survey, a series high
- [NAHB Survey of Construction](https://eyeonhousing.org/2025/10/square-foot-prices-moderate-in-2024/) — per-square-foot price benchmarks by region
- [NAHB regulatory cost study, June 2026](https://eyeonhousing.org/2026/06/home-building-regulatory-cost-burdens-increased-40-from-2021-to-2026/) — regulation accounts for 26.4% of the final price of a new single-family home
- [NAHB research studies index](https://eyeonhousing.org/research-studies/)

## How a figure is produced

1. **Define the scenario.** Square footage, jurisdiction, construction type, site condition, finish grade — all fixed and stated in the post.
2. **Anchor to permit records.** Pull declared construction valuations for comparable recent builds in the same jurisdiction. This sets the plausible total.
3. **Allocate across the six phases.** Use published phase-level cost shares, adjusted for the specific scenario.
4. **Sanity-check per square foot.** Compare against published per-square-foot benchmarks for the region and construction type — and account for the small-unit premium described below.
5. **State it as a median, with the variables that move it.** Every post lists the factors that push the number up or down and by roughly how much.

## Why ~$400/sq ft is not a contradiction of NAHB ~$167/sq ft

Step 4 compares our models to NAHB's Survey of Construction square-foot prices. For contractor-built (custom) single-family detached homes started in 2024, NAHB's national median was **$166 per square foot**; the **Pacific** division median was **$167 per square foot** ([Eye on Housing, Oct 2025](https://eyeonhousing.org/2025/10/square-foot-prices-moderate-in-2024/)). Those figures exclude improved lot value.

Our Los Angeles County mid-grade detached ADU models land near **$400/sq ft** (800 sq ft) and **$537/sq ft** (400 sq ft). That is roughly **2.4×** the Pacific custom-home median on the 800 model — and it is intentional, not a failed check.

| What NAHB SOC measures | What our ADU models measure |
| --- | --- |
| Full-size new single-family detached homes | Accessory units of 400–800 sq ft |
| Economies of scale across a whole house | One kitchen + one bath that barely shrink |
| National / Census division medians | Southern California mid-grade, site-built |
| Contract price ÷ finished floor area | Same six-phase build cost ÷ ADU floor area |

**Small-unit premium (why the multiple exists):**

1. **Fixed rooms dominate.** A kitchen and a bathroom cost nearly the same at 400 or 1,200 sq ft. On an 800 sq ft ADU they are almost half the budget; on a 2,400 sq ft house they are a much smaller share.
2. **Fixed site and utility work.** Sewer lateral, electrical service run, and foundation mobilization do not scale linearly with floor area.
3. **Soft costs and fees are front-loaded.** Design, plan check, and many agency fees are closer to fixed (or step-function) than to $/sq ft.
4. **Geography and product.** Pacific custom medians mix a wide range of house sizes and markets; our scenarios are small Southern California ADUs with mid-grade finishes.

So the NAHB number is a **floor and a scale check**, not a target $/sq ft for an ADU. If an ADU model came in near $167/sq ft for a detached SoCal build, we would treat that as suspiciously low relative to permit valuations and phase shares — not as “validated.”

## The 750 sq ft impact-fee cliff

California law draws a hard line on many **impact fees** (not connection or capacity charges):

- An ADU with **750 square feet of interior livable space or less** generally cannot be charged impact fees by a local agency, special district, or water corporation.
- Above 750 sq ft, any such impact fees must be charged **proportionately** relative to the square footage of the primary dwelling.

See [Government Code §66311.5](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=13&division=1.&lawCode=GOV&part=&title=7.) and the [HCD ADU Handbook](https://www.hcd.ca.gov/building-standards/adu/handbook). School developer fees sit under a **separate** Education Code framework (with a distinct ~500 sq ft threshold in current law) — always verify with the school district.

That cliff matters for sizing: our **400** model sits below it; the **800** model sits just above it. Soft-cost totals in this series still only diverge by about **$4,000** between those two models because design and plan check dominate phase one in Los Angeles County mid-grade scenarios, and many local ADU fee schedules were already compressed. In cities that still levy large proportional impact fees above 750 sq ft, the soft-cost step can be much larger than our LA County medians imply. Details and local verification steps: [ADU soft costs](/posts/adu-soft-costs-permits-california/).

## Known limitations

We would rather state these than have you find them.

- **Declared permit valuations understate real cost.** Builders declare a valuation for fee purposes, and it is typically lower than the contract price. We use them as a floor and a relative signal, not as the total.
- **Medians hide variance.** Half of real projects land above the number on the page. Site conditions are the largest single cause.
- **Regional data is thin outside Southern California.** Every figure on this site is currently anchored to Los Angeles County. Do not transfer it to another state without adjustment.
- **Cost data ages fast.** Material prices and labor rates move quarterly. Every post carries a "last verified" date for this reason.
- **We have not inspected these projects.** These are modeled scenarios built from public records, not audited job costs.
- **We do not subscribe to proprietary estimating databases.** Every source on this page is publicly accessible, deliberately, so that you can open it and check us.
- **Impact-fee cliffs are jurisdiction-specific in dollar terms.** State law sets the 750 sq ft rule; the dollar step depends on the local fee schedule.

## How this content is produced

Research, drafting, and modeling on this site are AI-assisted. Every figure is traced to a named, linked source that you can open and check yourself, and every correction is logged in public.

We disclose this because the alternative — being quiet about it — would contradict the only thing this site is actually selling, which is that you can verify what we tell you.

## Corrections policy

See [Corrections](/corrections/).
