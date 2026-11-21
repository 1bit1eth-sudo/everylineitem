# CLAUDE.md — everylineitem.com

Working rules for any agent (human or AI) editing this repository.
The site is everylineitem.com: California ADU / residential construction
costs, analyzed as a six-step ledger. All reader-facing content is English.

## Data fallback rules (no estimated values, ever)

These rules exist because an estimated fee, once written into the data,
looks exactly like a verified one. A missing value is honest; a guessed
value is not.

### 1. Follow the schema example

Every data addition or edit must follow `docs/schema-example.json`
100% — same fields, same types, same value rules. The file holds one
real fee-item record and one real jurisdiction record copied verbatim
from `src/data/fees.json`, plus a field guide that marks each field
required or optional and states its rule. The field for the check date
is `last_verified` (the pack's "checked_date" is this field).

### 2. Never auto-overwrite on doubt — file a `[확인 필요]` report instead

When collecting or updating data, if any item has:

- no source URL, or
- a source that fails to parse, or
- a sudden change of 10% or more against the previous value, or
- an unclear status (the source does not say what the fee is, or two
  sources disagree),

do **not** overwrite the live data (`src/data/fees.json`, the public
CSVs, or any page). Record only the following in
`docs/REVIEW_NEEDED.md` and leave the data untouched:

- `[확인 필요]` tag,
- the source snippet (the exact lines from the official document),
- the official source URL,
- the check date (YYYY-MM-DD).

No estimate, no interpolation, no "probably". A human reviews
`REVIEW_NEEDED.md` and decides. The file is created on first use;
an empty review queue means there is no file, not that review was
skipped.

### 3. Bulk changes need a sample dry run in the PR

A script that changes 20 or more items at once must attach the
results of a 10–20 item sample dry run to the PR body: which items
were sampled, what changed (before → after), and what was checked.
The full run goes in only after the sample is reviewed. Never commit
a bulk change whose sample was not shown.

## Standing repo rules

- **Language:** English only on the site. Never add Chinese characters.
- **Sources:** fee numbers only from official sources (.gov, city/county
  code, school-district or utility official documents). If it cannot be
  found, write "not found + why" — never guess.
- **Changes:** branch + pull request only. Never push directly to main.
  Never merge or deploy without the maintainer's explicit go-ahead.
- **Build:** `npm run build` must pass (Astro check + build +
  check-quality) before a PR is opened. Build-regenerated CSVs
  (`public/downloads/adu-fee-index-*.csv`) are restored, not committed.
