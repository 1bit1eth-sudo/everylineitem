# everylineitem — agent notes

Site: https://everylineitem.com
Repo: 1bit1eth-sudo/everylineitem
Stack: Astro (AstroPaper-based) static site. Muse merges; other agents must not merge to `main`.

## Repo map

| Path | What it produces |
| --- | --- |
| `src/data/fees.json` | Source of truth for jurisdiction fee lines, official `fee_schedule_url`, and `last_verified`. Drives `/fees/<slug>/`, comparators, the fee index, CSV, and numeric checks. |
| `src/data/fee-changelog.json` | Public fee-change log at `/changes/` |
| `src/data/propertyTaxRates.json` | `/property-tax/` |
| `src/data/aduScenarios.ts` | Scenario helpers used by tools / posts |
| `src/lib/feeCalc.ts`, `src/lib/feeReport.ts` | Calculator and report math |
| `src/lib/sb1117Pages.ts` | `/sb-1117/` and `/sb-1117/<slug>/` |
| `src/content/posts/*.md` | Blog posts at `/posts/<slug>/` (`src/pages/posts/`) |
| `src/content/pages/*.md` | Static pages (about, methodology, privacy, terms, …) |
| `src/pages/fees/` | `/fees/` index and `/fees/<slug>/` |
| `src/pages/compare.astro`, `tools.astro`, `worksheet.astro`, `fee-index.astro` | Tools |
| `src/pages/benchmarks.astro`, `changes.astro`, `property-tax.astro` | Data views |
| `src/components/FeeCalculator.astro`, `JurisdictionCompare.astro` | Interactive widgets |
| `public/ads.txt` | AdSense seller line |
| `scripts/check-quality.mjs` | Build quality gate (token/notes, title/description, fees.json consistency) |
| `scripts/verify-live.mjs` | Post-deploy live check (not part of `npm run build`) |
| `.github/workflows/ci.yml` | `npm ci`, `lint`, `format:check`, `build` |

## Commands

```sh
npm ci
npm run lint
npm run format:check
npm run build          # astro check + build + pagefind + check-quality
npm run verify:live    # against https://everylineitem.com after a deploy
```

## Site rules

- Do not change values in `src/data/fees.json` (or `fee-changelog.json` / `propertyTaxRates.json`) without an official source URL and a checked date. Put that source and date in the PR body. Status fields (`to_verify`, `illustrative`) mean the numbers are not yet, or not, official — do not quietly promote them.
- `scripts/check-quality.mjs` already checks source URLs, `last_verified` dates, numeric consistency with the public CSV, and title/description length on indexable pages. Keep those passing; do not weaken them.
- No unrendered template tokens or internal notes (`TODO`, `FIXME`, Korean memo text) in reader copy.
- Every page needs a non-empty `<title>` and meta description. Aim for title ≤ 60 and description ≤ 160 on indexable pages (the quality script warns where this was already over on main).
- Do not invent replacement official URLs. If a source link is gone, say so; do not guess a new one.
- Noindex / sitemap: do not flip `noindex` on or off unless that is the point of the PR (for example a thin downloads or city page). After deploy, `npm run verify:live` must not show a noindex URL inside the sitemap.
- Do not add new public URL patterns or rewrite slugs unless the operator asks.

## PR conventions

- Small, atomic PRs: one concern each. A lint-only change must not rewrite `fees.json` or run Prettier across post content.
- Run `npm run lint` and `npm run build` before opening the PR. (`format:check` currently fails on many pre-existing files on main, including `fees.json`; do not mass-reformat those in an unrelated PR.)
- After Muse merges and the deploy finishes, run `npm run verify:live` and paste the summary in the report.
- Merge order, when several PRs are open, is set by the operator or the current everylineitem Muse instruction. Other agents must not merge.
