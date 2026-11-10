---
title: Corrections
description: Our correction policy and the full log of changes to published figures.
---

Cost figures age, jurisdictions change their fees, and we make mistakes.

**When a number on this site is wrong, we change it and we log the change here.** We do not quietly edit and move on. The original figure, the new figure, and the reason all stay visible.

## Why we do this

Anyone can publish a cost estimate. What separates a useful cost estimate from a guess is whether the person publishing it will stand behind it in public when it turns out to be wrong.

A correction log is the cheapest possible proof that we will.

## What counts as a correction

| Type | Handling |
| --- | --- |
| A figure was wrong | Logged below with old value, new value, and reason |
| A source changed — fee schedule, state law | Logged below, post updated, "last verified" date advanced |
| Routine quarterly re-verification, no change | "Last verified" date advanced, not logged |
| Typo, formatting, added link | Not logged |

## Report an error

If a figure here does not match your local permit records, your actual quote, or a source you can point to — tell us. Include the post, the figure, and what you are seeing instead.

[corrections@everylineitem.com](mailto:corrections@everylineitem.com)

The most valuable messages we get are from contractors and estimators telling us where the model breaks. We would rather find that out at build ten than at build fifty.

## Change log

### 10 November 2026 — Campbell school fee corrected: $5.40 → $5.38 combined ($4,320 → $4,304)

**Changed:** The Campbell Union School District (K-8) developer fee is **$3.77/sq ft**, not $3.79 — so Campbell's combined school fee on an 800 sq ft ADU is **$4,304 ($5.38/sq ft)**, not $4,320 ($5.40/sq ft). The Campbell post's title, key facts, FAQ, phase table and "Why Campbell stands out" section are corrected, as is the Pasadena–Campbell gap post ($2,528 → $2,512). The "highest school-fee rate in this series" claim is withdrawn: $5.38 is the Level I cap, shared by the whole cap tier. The post total (~$310,000) is unchanged — the $16 difference rounds away; cost per square foot follows the corrected arithmetic, $388 → $387.

**Reason:** The district's own School Facilities Fee Justification Report (Mar 17, 2026) justifies $3.77/sq ft (70% of the $5.38 SAB cap), and Campbell Union HSD's May 7, 2026 report (Table 8) independently lists the feeder-district share as $3.77. The district webpage's $3.79 cell is stale: $3.79 + $1.61 would total $5.40, above the Level I cap, while $3.77 + $1.61 = $5.38 exactly.

**Source:** [Campbell Union School District Developer Fees page](https://www.campbellusd.org/developerfees) (Mar 17, 2026 Fee Justification Report linked there); corroborated by Campbell Union HSD's May 7, 2026 School Facilities Fee Justification Report, Table 8.

### 8 November 2026 — Moreno Valley: "$0 impact fees" corrected to $0 City DIF only (after publication)

**Changed:** The Moreno Valley post no longer states the impact fee is **$0** for an ADU. The adopted DIF schedule (effective July 1, 2023) lists the City DIF as Exempt for an ADU, but the same schedule's ADU row lists the other impact-fee columns as proportional for ADUs 750 sq ft and larger — DIF[2] and SKR mitigation "Based on Square footage," MSHCP $500/acre, TUMF by the proportional rule, and Workforce Development $0.13/sq ft — so an 800 sq ft ADU can owe those fees. The title, keyFacts, FAQ answers, summary and comparison tables, the fee table (five proportional rows added), the footnote section, and the SB 1117 section now carry the corrected framing: City DIF **$0**, proportional lines disclosed but not totalled. The post's **$310,000** total is unchanged. The post was published 7 Nov 2026 with the "$0 impact fees" wording; the error was caught the same day.

**Reason:** The schedule's ADU row was read as the City DIF column only. A same-day re-check of the adopted schedule, the city's ADU handout ("DIF fees will apply to ADUs that are 750 square feet or larger"), and the city's October 2025 payment register (ADUs pay MSHCP in practice — $35,862.26 collected for August 2025) showed the proportional lines apply at 750+ sq ft. The 2024 DIF schedule and study never mention ADUs, so they do not overturn the 2023 ADU row; Resolution No. 2025-22 (adopted April 15, 2025) deferred the 2024 schedule's automatic increases to January 1, 2028 and January 1, 2030.

**Source:** [City of Moreno Valley Development Impact Fee schedule (effective July 1, 2023)](http://ci.moreno-valley.ca.us/departments/financial-mgmt-svcs/fin-pdf/ImpactFees.pdf), [City of Moreno Valley ADU handout (revised August 3, 2023)](https://Moreno-valley.ca.us/city_hall/forms/building-safety/ADU-pkg.pdf), [City Council minutes, April 15, 2025, Item J.2 — Resolution No. 2025-22](https://pub-morenovalley.escribemeetings.com/FileStream.ashx?DocumentId=4461), [City of Moreno Valley October 2025 Payment Register](http://moreno-valley.ca.us/departments/financial-mgmt-svcs/pdf/fin-ops/reg/2025/2025-October.pdf)

---

### 7 November 2026 — Fee calculator and comparison totals: unverified fees excluded

**Changed:** The /compare/ fee calculator, the two-city comparison, and the emailed PDF report now total **verified fees only**. Rows marked `to_verify` (or `conflict`) are listed by name with no figure and their would-be amounts are reported once as an excluded range — they no longer enter any total, subtotal, comparison, chart, or $/sq ft figure. Jurisdictions with no verified lines show "No verified fees yet" instead of a dollar total, and no comparison is drawn when either side has no verified fees. The embeddable fee card shows the same "No verified fees yet" state instead of $0.

**Scope of the error:** Every jurisdiction with unverified rows was affected. The largest case was Clovis: the calculator showed **$76,895** for an 800 sq ft ADU as if it were a total, when all 14 rows on file were unverified — including $57,445 of impact fees. The same pattern showed $27,283 for South Pasadena (10 unverified rows), $17,016 for San José (3 of 5 rows unverified), $16,936 for Oakland (the $12,800 conflict permit line included), $14,957 for Fullerton, and $11,806 for Sacramento. Verified-only totals are lower in every mixed case (Clovis $76,895 → no total shown; South Pasadena $27,283 → no total shown; San José $17,016 → $10,676; Oakland $16,936 → $4,136; Fullerton $14,957 → $6,836; Sacramento $11,806 → $4,104). Jurisdictions whose rows were all verified are unchanged (Redlands $6,993, Santa Clara $11,369, Milpitas $709).

**Reason:** The calculator's shared engine (`src/lib/feeCalc.ts`) summed every in-scope row regardless of verification status. The fee pages (`/fees/[slug]/`) were already verified-only since the 5 Nov 2026 template fix (PR #167) — only the /compare/ calculator, the two-city comparison, and the PDF report still summed unverified rows. The fix applies the verification gate at the calculation source, so all three surfaces (plus the embed card) now agree with the fee pages. The fee index, SB 1117 pages, and homepage cliff were already verified-only and are unchanged.

**Note:** The excluded range for Clovis ($76,895) is itself the sum of the unverified rows on file, not a bill for one parcel — it adds mutually exclusive variants together (both Water Major density rates, $13,795 and $5,655; all five Major Street area fees). Those rows need area/density tags in a follow-up data fix; this change does not alter fees.json.

**Source:** `src/data/fees.json` (Clovis rows CLOVIS-NEW-01–14, all `to_verify`, verified 5 Nov 2026); calculator code `src/lib/feeCalc.ts` (`calcJurisdiction`, `resultsHTML`, `sideBySideHTML`).

**Live date:** 7 November 2026.

---

### 6 November 2026 — Fee-waiver cities: Oceanside waiver marked unconfirmed (after publication)

**Changed:** The fee-waiver post no longer states that Oceanside's ordinance waives all ADU impact fees. The Oceanside section now says the waiver is **unconfirmed**: the waiver language our September 2025 capture showed is no longer on the city's ADU page, and the city says information relying on the ADU ordinance (Article 30, Section 3006) is no longer applicable while it certifies the ordinance with HCD. The post's description, both Oceanside FAQ answers, the durability ranking (Oceanside now third, unconfirmed), and the bottom line now read "two confirmed $0s, one unconfirmed." The new parks fee schedule (single-family $6.03/sq ft, effective January 20, 2026, Resolution #25-R0669-1) is still reported, with its ADU application marked not confirmed. The post was published 6 Nov 2026 with the waiver stated as fact; the error was caught the same day.

**Reason:** Live check of the city's ADU page on 6 November 2026 found the waiver language gone and an HCD certification notice in its place. The September 2025 capture is no longer evidence for a live $0 claim.

**Source:** [City of Oceanside ADU page](https://www.ci.oceanside.ca.us/government/development-services/planning/accessory-dwelling-unit-adu), [City of Oceanside Fee Schedule (parks revised effective January 20, 2026; Resolution #25-R0669-1)](https://www.oceansidelibrary.org/home/showpublisheddocument/10180/639171152084370000)

---

### 6 November 2026 — Oceanside: $0 DIF exemption marked unconfirmed (after publication)

**Changed:** The Oceanside post no longer presents the ordinance's $0 DIF as settled. The $0 is now marked **unconfirmed (6 Nov 2026)**: the city's ADU page no longer carries the waiver language this post captured in September 2025, and the city says information relying on the ADU ordinance (Article 30, Section 3006) is no longer applicable while it certifies the ordinance with HCD. The title now reads "The $0 Exemption, Unconfirmed"; the description, editor's note, first paragraph, FAQ, fee tables, and SB 1117 section carry the same status. The park fee the 2025 draft proposed is now an adopted schedule (single-family $6.03/sq ft, effective January 20, 2026, Resolution #25-R0669-1), with its ADU application marked not confirmed — the draft's up-to-$4,824 figure is now framed as the adopted schedule's figure if it applies to ADUs. Last verified advanced 22 Oct → 6 Nov 2026. The post's $313,000 total is unchanged (it was priced on the ordinance's $0), but the total now rests on an unconfirmed line. The post's ogImage still shows the previous title and needs a new image in the next design round.

**Reason:** Live check of the city's ADU page on 6 November 2026 found the waiver language gone and an HCD certification notice in its place; the park schedule's adoption was confirmed from the city's official fee schedule PDF the same day.

**Source:** [City of Oceanside ADU page](https://www.ci.oceanside.ca.us/government/development-services/planning/accessory-dwelling-unit-adu), [City of Oceanside Fee Schedule (parks revised effective January 20, 2026; Resolution #25-R0669-1)](https://www.oceansidelibrary.org/home/showpublisheddocument/10180/639171152084370000)

---

### 5 November 2026 — ADU fire sprinklers: detached-ADU exception corrected (before publication)

**Changed:** The sprinkler post's decision table flipped for the most common case: a new detached ADU with an unsprinklered primary home was **Yes** and is now **No — if all four R309.2 conditions are met** (state-law ADU, unsprinklered primary, detached ADU ≤1,200 sq ft, same lot); **Yes if any condition fails** (e.g. over 1,200 sq ft). The post previously cited CRC R313.2; the section is now **R309.2** in the 2025 California Residential Code, with the ADU exception stated in full and linked. The Los Altos Hills framing is corrected: the 1,200 sq ft exception is state law, not a local carve-out. FAQ #1 (the two-question test) and the bottom line now carry the same exception. The post is scheduled to publish 13 Nov 2026; the error was caught before publication. Last verified advanced 9 Oct → 5 Nov 2026 for the rule section; cost ranges are unchanged from the 9 Oct check.

**Reason:** The 2025 California Residential Code renumbered R313.2 → R309.2 and kept the ADU exception (Exception 2). The post's Yes was the reverse of the code: a detached ADU meeting all four conditions is expressly exempt.

**Source:** [2025 California Residential Code §R309.2](https://up.codes/viewer/california/ca-residential-code-2025/chapter/3/building-planning#R309.2), [Gov. Code §66313 (ADU definition)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=66313.&lawCode=GOV), [CAL FIRE Information Bulletin 25-004](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ib-25004-adu.pdf)

### 4 November 2026 — Campbell: permit example, impact-fee cap, and total corrected to the FY 2027 schedule

**Changed:** Campbell post total **~$318,000 → ~$310,000** (~$398 → ~$388/sq ft). Building permit example on a $100,000 valuation **~$3,529 → $2,880** core (2.00% permit + 33% plan check + General Plan 0.16% + technology 0.04% + training 0.02%), plus $254 in schedule add-ons (Title 24 $237, seismic $13, SB 1473 $4) and the $400 construction license tax, for $3,534 in permit-related lines. The previous $3,929 all-in figure is withdrawn — its $649 remainder did not reconcile with the schedule's published add-ons. Impact fee no longer "rates not published": the FY 2027 schedule (effective July 1, 2026) publishes a Park In-Lieu cap of **$9,328 per unit** for an ADU of 750 sq ft or larger, calculated per state law, JADU $0 (the FY 2026 cap was $9,129). The cited schedule resolution is corrected: the FY 2026 cover was #13333, not #13279, and the FY 2026 document link is no longer live — the city's site now lists only the FY 2026-27 schedule. West Valley Sanitation sewer figures ($567.68/drainage fixture unit, cap $6,727; $86.42/fixture unit capacity, cap $1,024) are now marked [to verify]: the district's current published schedule could not be located, so they are carried from FY 2024-25 rates. Campbell Union's mixed threshold wording is now flagged: its rate table says "over 500 sq. ft." while its "Who Pays" section says "exceeding 750 square feet" — both on the same district page. Published date unified to 2 Nov 2026 (the post's timestamp previously rendered as 1 Nov in Pacific time).

**Reason:** Cross-check against the city's current fee schedule and the school district's developer-fee page.

**Source:** [City of Campbell FY 2027 Master Fee Schedule (effective July 1, 2026)](http://www.campbellca.gov/DocumentCenter/View/29705/FY-2027-Master-Fee-Schedule---Effective-July-1-2026), [Campbell Union School District developer fees](https://www.campbellusd.org/developerfees)

### 7 October 2026 — Anaheim: city reply received after publication

**Changed:** Anaheim post no longer states "no reply by publication." The city's Building Division replied on Oct 7, 2026, after publication: sanitation fees average **$1.71/sq ft** (the city's own figure, matching OC San's average-demand rate) and park fees apply to construction of **750 sq ft and above**. School-fee questions were treated as address-specific; water connection charges were referred to Water Engineering.

**Reason:** Published commitment ("updated when the city responds"). The OC San line now reads **$1,368–$1,710**: the city's $1.71/sq ft average prices 800 sq ft at $1,368, while OC San's Table A "per 1,000 sq ft or portion thereof" would round to $1,710 — the rounding basis and the applicability to a detached ADU are still unconfirmed. No change to the $320,000 total. The 2026 impact-fee resolutions' adoption and ADU calculation basis remain unconfirmed.

**Source:** City of Anaheim Building Division reply email (Oct 7, 2026), [OC San CFCC Table A](https://ocsan.gov/wp-content/uploads/2024/06/Facts-and-Key-Statistics.pdf)

### 6 October 2026 — San Francisco: school district fee verified and added

**Changed:** San Francisco post total **$322,000 → $325,000** ($403 → $406/sq ft). The school district developer fee — previously marked "verifying with SFUSD" and excluded from the total — is now confirmed at **$3.79/sq ft** ([San Francisco development impact fee register](https://sfplanning.org/sites/default/files/forms/Impact_Fee_Schedule.pdf)), adding **$3,032** on an 800 sq ft unit. Soft costs move $34,000 → $37,000; the LA comparison gap moves +$2,000 → +$5,000.

**Reason:** Cross-post audit found the rate already cited in our San José post. Verified against the city's official register before applying.

### 6 October 2026 — Statute renumbering: Gov. Code §66324 → §66311.5

**Changed:** San Francisco and Oakland posts now cite **Gov. Code §66311.5** (SB 543, effective 1 Jan 2026) for the 750 sq ft impact-fee exemption, replacing the repealed §66324. Also fixed a mislinked citation in the San Francisco post that pointed to Ed. Code §17620.

**Reason:** Integrity audit. No figures changed.

### 6 October 2026 — Oakland: pre-approved ADU plans program documented

**Changed:** Oakland post no longer states that no pre-approved ADU plan program exists. The city publishes [off-the-shelf pre-approved studio, 1-BR, and 2-BR ADU plans](https://www.oaklandca.gov/My-Household/Building-and-Remodeling/Homeowner-Projects-Permits/Accessory-Dwelling-Units-ADUs/Apply-for-ADUs-with-Pre-Approved-Plans); the $14,000 design line is now described as the full-freight custom-design baseline.

**Reason:** Integrity audit; link verified live.

### 6 October 2026 — Rounding rule unified to $538

**Changed:** The 400 sq ft post's $/sq ft figure **$537 → $538** ($215,000 ÷ 400 = $537.50), matching the round-half-up rule used in the San Francisco and Oakland posts. Same correction applied wherever the figure is referenced (series nav, methodology, SEO data).

**Reason:** Integrity audit. One-dollar rounding consistency; no cost model change.

### 9 September 2026 — Soft costs & Methodology: 750 sq ft cliff and NAHB $/sf check

**Changed:** Soft-costs post and Methodology now name the **750 sq ft** impact-fee threshold (Gov. Code §66311.5) instead of “certain sizes,” clarify connection fees vs impact fees and school-fee rules, and explain why series soft costs only move ~$4,000 from 400→800 sq ft. Methodology adds an explicit **small-unit premium** decomposition of ~$400/sq ft ADU models vs NAHB Pacific custom ~$167/sq ft.

**Reason:** Readers could not verify the size rule or the NAHB sanity-check without those numbers. Phase totals were not restated.

**Source:** [Gov. Code §66311.5](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=13&division=1.&lawCode=GOV&part=&title=7.), [HCD ADU Handbook](https://www.hcd.ca.gov/building-standards/adu/handbook), [NAHB Survey of Construction / Eye on Housing](https://eyeonhousing.org/2025/10/square-foot-prices-moderate-in-2024/)

---

### 5 September 2026 — Methodology sources revised, all posts

**Changed:** Removed a reference to a proprietary subscription cost database from the sources table on every post.

**Reason:** We do not hold that subscription. Listing it implied a level of access we do not have. Every source on this site should be one a reader can open and check without paying for anything, and it now is.

**Replaced with:** [NAHB Cost of Construction Survey](https://eyeonhousing.org/2025/01/cost-of-constructing-a-home-in-2024/) and [NAHB Survey of Construction](https://eyeonhousing.org/2025/10/square-foot-prices-moderate-in-2024/), both publicly accessible. Phase totals were re-checked against both and did not change materially.

---

### 5 September 2026 — Corrections policy established

This page was created. All published figures were re-verified against [California HCD](https://www.hcd.ca.gov/building-standards/adu/handbook), [EPIC-LA](https://epicla.lacounty.gov/), and [LADBS](https://www.ladbsservices2.lacity.org/onlineservices/?service=plr) permit records on this date.

---

**Format used for each entry:**

> **[Date]** — *[Post title]*
> **Changed:** [line item] from $X to $Y
> **Reason:** [what we learned and where]
> **Source:** [link]
