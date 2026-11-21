# everylineitem audit

- Date: 2026-11-22 (KST)
- Script: scripts/audit-everylineitem.mjs (Node built-ins only, no packages)
- Result: FAIL — 53 FAIL, 2 WARN, 22 PASS
- Data checked: fees.json 798 fee items

## Summary

| Check | FAIL | WARN | PASS |
| --- | ---: | ---: | ---: |
| 6-step model | 0 | 0 | 2 |
| banned phrases | 0 | 0 | 1 |
| benchmark CSVs | 0 | 0 | 12 |
| disclaimers | 0 | 1 | 2 |
| fees.json | 53 | 1 | 3 |
| json-parse | 0 | 0 | 2 |

## FAIL

- [fees.json] CLOVIS-NEW-01: missing required key "confidence"
- [fees.json] CLOVIS-NEW-07: missing required key "confidence"
- [fees.json] CLOVIS-NEW-08: missing required key "confidence"
- [fees.json] CLOVIS-NEW-15: missing required key "confidence"
- [fees.json] SP-NEW-02: missing required key "confidence"
- [fees.json] SP-NEW-05: missing required key "confidence"
- [fees.json] SP-NEW-06: missing required key "confidence"
- [fees.json] SP-NEW-07: missing required key "confidence"
- [fees.json] SP-NEW-08: missing required key "confidence"
- [fees.json] SP-NEW-09: missing required key "confidence"
- [fees.json] SP-NEW-10: missing required key "confidence"
- [fees.json] SG-NEW-01: missing required key "confidence"
- [fees.json] SG-NEW-02: missing required key "confidence"
- [fees.json] SG-NEW-03: missing required key "confidence"
- [fees.json] SG-NEW-04: missing required key "confidence"
- [fees.json] SG-NEW-05: missing required key "confidence"
- [fees.json] CARLSBAD-NEW-02: missing required key "confidence"
- [fees.json] CARLSBAD-NEW-04: missing required key "confidence"
- [fees.json] CARLSBAD-NEW-05: missing required key "confidence"
- [fees.json] CARLSBAD-NEW-13: missing required key "confidence"
- [fees.json] VACAVILLE-NEW-07: missing required key "confidence"
- [fees.json] VACAVILLE-NEW-08: missing required key "confidence"
- [fees.json] VACAVILLE-NEW-09: missing required key "confidence"
- [fees.json] VACAVILLE-NEW-10: missing required key "confidence"
- [fees.json] VACAVILLE-NEW-11: missing required key "confidence"
- [fees.json] CLOVIS-NEW-16: missing required key "confidence"
- [fees.json] CLOVIS-NEW-17: missing required key "confidence"
- [fees.json] CLOVIS-NEW-18: missing required key "confidence"
- [fees.json] CLOVIS-NEW-19: missing required key "confidence"
- [fees.json] CLOVIS-NEW-20: missing required key "confidence"
- [fees.json] CLOVIS-NEW-21: missing required key "confidence"
- [fees.json] CLOVIS-NEW-22: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-09: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-10: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-11: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-12: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-13: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-14: missing required key "confidence"
- [fees.json] DIAMOND-BAR-NEW-15: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-01: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-02: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-03: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-04: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-05: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-07: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-08: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-10: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-11: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-12: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-13: missing required key "confidence"
- [fees.json] LA-PUENTE-NEW-14: missing required key "confidence"
- [fees.json] jurisdiction LAKEWOOD: missing official fee_schedule_url
- [fees.json] jurisdiction ONTARIO: missing official fee_schedule_url

## WARN

- [fees.json] FI-011 (SAN-JOSE, to_verify): no last_verified recorded yet
- [disclaimers] Property tax calculator carries "planning math, not an assessment" but not the literal "not tax advice" wording — consider adding it

## Missing sources / checked dates by jurisdiction

- **LAKEWOOD** (1): (jurisdiction): missing fee_schedule_url
- **ONTARIO** (1): (jurisdiction): missing fee_schedule_url

## PASS

- [fees.json] src/data/fees.json parses as JSON
- [fees.json] 798 fee items checked (source + checked date on verified rows)
- [fees.json] 164 jurisdictions checked (fee_schedule_url + last_verified)
- [json-parse] src/data/fee-changelog.json parses as JSON
- [json-parse] src/data/propertyTaxRates.json parses as JSON
- [6-step model] 5 construction phases sum to the $288,000 subtotal
- [6-step model] design cost $14,000 (6th step)
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-11.csv: 538 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-12.csv: 540 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-13.csv: 546 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-14.csv: 653 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-15.csv: 659 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-17.csv: 659 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-11-18.csv: 659 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-2026-q3.csv: 659 rows, all with source + checked date
- [benchmark CSVs] public/downloads/adu-fee-index-latest.csv: 659 rows, all with source + checked date
- [benchmark CSVs] adu-fee-index-latest.csv row count (659) matches fees.json verified count
- [benchmark CSVs] public/downloads/adu-benchmark-ranges-2026-q3.csv: 7 phase rows, ranges ordered low <= median <= high with notes
- [benchmark CSVs] public/downloads/adu-six-phase-worksheet.csv: 7 rows (fill-in template; blank quote cells are by design)
- [disclaimers] Bid Scanner (quote checker) (public/bid-scanner/index.html): disclaimer present — "not quotes", "modeled, not quotes" — e.g. "Construction ranges are modeled, not quotes. This scanner flags questions — it does not judge a contractor."
- [disclaimers] Property tax calculator (src/pages/property-tax.astro): disclaimer present — "planning math, not an assessment", "not an assessment" — e.g. "This is planning math, not an assessment. Only your county assessor"
- [banned phrases] no banned phrases in 223 content/page files + fees.json reader-visible fields ("guaranteed cost", "guaranteed price", "official tax advice", "official legal advice")

## Notes

- The fee data lives in src/data/fees.json; the site is Astro + Cloudflare Worker, not a framework-less static site. The audit reads the real data files.
- `threshold` in fees.json is a descriptive string or a number, so it is not numeric-checked; only rate_low / rate_high / base / step are.
- adu-six-phase-worksheet.csv is a fill-in template: blank quote/median cells are by design. Blank amount_800_sqft in the fee-index CSV means the row has no computable amount at 800 sq ft; a non-blank amount may be a single number or a low-high range.
- Unverified rows are marked by status "to_verify" in fees.json (the literal "[확인 필요]" string is forbidden in reader text by the site's own build gate, E5).
- Construction phases are modeled from the Los Angeles County baseline (no city publishes phase-level construction costs); their source is the benchmark ranges CSV and the posts it cites, not a government fee schedule.
- This script complements scripts/check-quality.mjs (which runs on the built dist); it checks source files directly and adds the CSV, disclaimer, and banned-phrase checks.
