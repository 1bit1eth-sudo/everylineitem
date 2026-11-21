# Fee audit

- Date: 2026-11-22 (KST)
- Script: scripts/audit-fees.mjs (Node built-ins only, no packages)
- Baseline for the change check: HEAD~1
- Result: FAIL — 2 FAIL, 1 WARN, 14 PASS
- Data checked: fees.json 798 fee items

## Summary

| Check | FAIL | WARN | PASS |
| --- | ---: | ---: | ---: |
| fee-index CSVs | 0 | 0 | 10 |
| fees.json | 2 | 1 | 3 |
| git diff | 0 | 0 | 1 |

## FAIL

- [fees.json] jurisdiction LAKEWOOD: missing official fee_schedule_url
- [fees.json] jurisdiction ONTARIO: missing official fee_schedule_url

## WARN

- [fees.json] FI-011 (SAN-JOSE, to_verify): no last_verified recorded yet

## Missing sources / checked dates by jurisdiction

- **LAKEWOOD** (1): (jurisdiction): missing fee_schedule_url
- **ONTARIO** (1): (jurisdiction): missing fee_schedule_url

## PASS

- [fees.json] src/data/fees.json parses as JSON
- [fees.json] 798 fee items checked (source + checked date on verified rows, numeric integrity)
- [fees.json] 164 jurisdictions checked (fee_schedule_url + last_verified)
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-11.csv: 538 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-12.csv: 540 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-13.csv: 546 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-14.csv: 653 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-15.csv: 659 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-17.csv: 659 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-11-18.csv: 659 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-2026-q3.csv: 659 rows, all with source + checked date
- [fee-index CSVs] public/downloads/adu-fee-index-latest.csv: 659 rows, all with source + checked date
- [fee-index CSVs] adu-fee-index-latest.csv row count (659) matches fees.json verified count
- [git diff] no fee amounts changed vs HEAD~1

## Notes

- The checked date (`last_verified`) is stored as ISO ("2026-10-16") or human ("7 Oct 2026"); both are accepted. The CSVs store ISO dates only.
- "Official government source" cannot be proven from the URL string alone (school districts use .org, water districts .com/.org). The audit checks the URL is an external http(s) link; that it points to an official document is established by the human verification behind status "verified".
- $0 is a legitimate fee value here (exemptions, shared connections, jurisdictions that levy no such fee), so zero amounts are not flagged. Only non-numeric, negative, and extreme values are.
- Extreme-value thresholds are heuristics (per-sq-ft rate above $50/sq ft, flat/base above $100,000) and warn only — the highest legitimate rates on file are $27.55/sq ft (Encinitas DIF) and $12.46/sq ft (Level II school fee).
- Unverified rows are marked by status "to_verify" in fees.json (the literal "[확인 필요]" string is forbidden in reader text by the site's own build gate, E5).
- This script overlaps with scripts/audit-everylineitem.mjs on source/date and CSV-integrity checks; it adds the git-diff spike detection. The broad gate also covers disclaimers, banned phrases, and the 6-step model.
