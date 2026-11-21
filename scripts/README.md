# scripts — fee source monitor

## What this is

`check-fee-sources.mjs` watches the official fee-schedule pages behind
the fee ledger (`src/data/fees.json`) and tells a human when one of them
changes. It never changes the data itself — a changed, missing, or
unparseable source is only recorded as a `[확인 필요]` entry, for a
human to re-verify against the official document (see `CLAUDE.md` rule 2).

## Files

- `fee-watch-list.json` — the 10 jurisdictions to watch, each with its
  official `fee_schedule_url`. Chosen 2026-11-22: top 10 by count of
  verified fee items, among jurisdictions whose recorded fee schedule
  URL is an external official URL (the everylineitem.com self-reference
  is excluded; LAKEWOOD and ONTARIO have no fee schedule URL and are
  excluded). Ties broken by `juris_id` ascending — #10 BEVERLY-HILLS
  (11 verified items) beat CLOVIS and REDLANDS (also 11) on that rule.
  ".gov etc." means the official fee schedule as recorded in fees.json;
  some are hosted on official non-.gov domains (a county document
  store, a water-district site, a code publisher).
- `check-fee-sources.mjs` — the monitor. Node built-ins only (`fetch`
  is global in Node 18+); no extra packages.
- `snapshots/` — one JSON file per jurisdiction with the last seen
  dollar-amount lines and a content hash. Created on the first real
  run; commit them — they are the baseline the next run compares
  against, like a lockfile. (Mock runs use a temp directory instead,
  so test snapshots never touch the real ones.)

## How to run

Real run (needs a Firecrawl API key — free tier is enough for 10 calls):

```sh
FIRECRAWL_API_KEY=fc-... node scripts/check-fee-sources.mjs
```

Test run (no key, no network — built-in mock pages):

```sh
node scripts/check-fee-sources.mjs --mock --report /tmp/fee-report.mock.md
node scripts/check-fee-sources.mjs --mock-v2 --report /tmp/fee-report.mock.md
```

The first mock run writes baselines (exit 0, no `[확인 필요]`). The
second (`--mock-v2`) simulates a changed amount (PASADENA $1,006 →
$1,102) and a 404 (BUENA-PARK), so it exits 1 and records two
`[확인 필요]` entries. That is the expected test result.

Options: `--report <path>` (default `docs/fee-audit-report.md`),
`--snapshots <dir>` (default `scripts/snapshots/`).

## Limits

- **At most 10 Firecrawl calls per run** (`MAX_CALLS = 10`,
  hardcoded). The watch list has exactly 10 entries, so one run is
  one call per jurisdiction. If the list ever grows, the extra entries
  are skipped and noted in the report.
- Calls are sequential, 500 ms apart.
- Each call times out after 60 s (a 403/404/timeout is recorded as
  `[확인 필요]`, and the previous snapshot is kept).

## Report

Each run appends a dated section to `docs/fee-audit-report.md` with
the counts and, for every `[확인 필요]` item, the jurisdiction, the
official URL, the check date (YYYY-MM-DD), and the before/after lines.

Two things to know about that file:

1. `scripts/audit-fees.mjs` regenerates `docs/fee-audit-report.md` on
   every run, which wipes sections appended here. **Copy any
   `[확인 필요]` entry to `docs/REVIEW_NEEDED.md`** (the human review
   queue) before running the audit, or the finding will be lost.
2. The monitor compares the official schedule *page*, not individual
   fee rows. When it flags a change, a human opens the official URL,
   finds which rows cite it, and re-verifies them — the script does
   not say which row changed.

## Exit codes

- `0` — all pages unchanged, or only baselines written.
- `1` — at least one `[확인 필요]` entry was recorded.
- `2` — usage / config error (no `FIRECRAWL_API_KEY` and no `--mock`,
  unreadable watch list).

## Firecrawl API key

Get one at https://www.firecrawl.dev (free tier). The key is read
from the environment (`FIRECRAWL_API_KEY`) and is never stored in the
repo. No key is currently configured for this project — the first real
run needs one.
