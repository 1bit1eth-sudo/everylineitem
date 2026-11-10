import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { calcJurisdiction, calcSB1117, jurisAreas } from "./src/lib/feeCalc";
import { generateFeeCsvFiles } from "./src/lib/csvExport";
import config from "./astro-paper.config";
import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { parseVerified } from "./src/utils/formatVerified";

// Post URL -> last modified date (modDatetime, else pubDatetime), read from
// frontmatter so sitemap entries carry an accurate <lastmod>.
const postLastmod = new Map<string, string>();
// pubDatetime (ms) of every non-draft post, for listing-page lastmod below.
const publishedPostPub: number[] = [];
for (const file of readdirSync("./src/content/posts")) {
  if (!/^[^_].*\.mdx?$/.test(file)) continue;
  const fm =
    readFileSync(`./src/content/posts/${file}`, "utf8").match(
      /^---\r?\n([\s\S]*?)\r?\n---/
    )?.[1] ?? "";
  if (/^draft:\s*true/m.test(fm)) continue;
  const pick = (key: string) =>
    fm.match(new RegExp(`^${key}:\\s*["']?([0-9][^"'\\s]*)`, "m"))?.[1];
  const date = pick("modDatetime") ?? pick("pubDatetime");
  if (date && !Number.isNaN(Date.parse(date))) {
    postLastmod.set(
      `/posts/${file.replace(/\.mdx?$/, "")}/`,
      new Date(date).toISOString()
    );
  }
  const pub = pick("pubDatetime");
  if (pub && !Number.isNaN(Date.parse(pub))) {
    publishedPostPub.push(Date.parse(pub));
  }
}

// Thin listing pages (noindex) are kept out of the sitemap.
const isThinPage = (pathname: string) =>
  /^\/tags\//.test(pathname) ||
  /^\/posts\/\d+\/$/.test(pathname) ||
  /^\/search\/?$/.test(pathname) ||
  /^\/embed\//.test(pathname);

// Fee pages with no fee rows at all are noindex (see src/pages/fees/[slug].astro);
// keep them out of the sitemap too. Computed with the same calculator the fee
// page uses, so the two stay in sync — including jurisdictions whose items are
// all skipped (e.g. Downey: one verified item, no rate, so no row renders).
// The set lifts itself when rows land; there is no manual list to maintain.
const feesData = JSON.parse(readFileSync("./src/data/fees.json", "utf8"));

// Public CSV, generated at build time from fees.json (verified rows only).
// Writes public/downloads/ (dated + latest + legacy q3 alias) so `astro
// build` copies them into dist/; check-quality E8 verifies the result.
const csvExport = generateFeeCsvFiles(feesData);
const zeroRowFeePages = new Set(
  feesData.jurisdictions
    .filter((j: { juris_id: string }) => j.juris_id !== "LA-BASE")
    .filter((j: { juris_id: string }) => {
      const areas = jurisAreas(feesData, j.juris_id);
      const results =
        areas.length > 0
          ? areas.map(a =>
              calcJurisdiction(feesData, j.juris_id, 800, { area: a })
            )
          : [calcJurisdiction(feesData, j.juris_id, 800)];
      return !results.some(r =>
        r.lines.some(
          (l: { item: { status: string }; kind: string }) =>
            (l.item.status === "verified" ||
              l.item.status === "to_verify" ||
              l.item.status === "conflict") &&
            l.kind !== "skipped"
        )
      );
    })
    .map((j: { juris_id: string }) => `/fees/${j.juris_id.toLowerCase()}/`)
);

// SB 1117 pages with no non-zero verified impact fees are noindex (see
// src/pages/sb-1117/[slug].astro); keep them out of the sitemap too.
// Computed with the same calculator the page uses, so the two stay in sync.
const noindexSB1117Pages = new Set(
  feesData.jurisdictions
    .filter((j: { juris_id: string }) => j.juris_id !== "LA-BASE")
    .filter((j: { juris_id: string }) => {
      const verifiedAny = feesData.fee_items.some(
        (i: { juris_id: string; status: string }) =>
          i.juris_id === j.juris_id && i.status === "verified"
      );
      if (!verifiedAny) return true;
      const areas = jurisAreas(feesData, j.juris_id);
      const runs = [800, 1000, 1200].flatMap(sqft =>
        areas.length > 0
          ? areas.map(a =>
              calcSB1117(feesData, j.juris_id, sqft, {
                area: a,
                verifiedOnly: true,
              })
            )
          : [
              calcSB1117(feesData, j.juris_id, sqft, {
                verifiedOnly: true,
              }),
            ]
      );
      const hasImpact = runs.some(r => r.hasImpactLines);
      const chargesImpact = runs.some(r => (r.currentHigh ?? r.currentLow) > 0);
      return !hasImpact || !chargesImpact;
    })
    .map((j: { juris_id: string }) => `/sb-1117/${j.juris_id.toLowerCase()}/`)
);

// lastmod for the 211 sitemap URLs that are not posts. Every value comes
// from a real record — nothing is invented, and a page with no record simply
// keeps no lastmod:
// - /fees/<slug>/ and /sb-1117/<slug>/: that jurisdiction's last_verified
//   date in fees.json (the day its fees were last checked).
// - Data hubs (/, /fee-index/, /fees/, /compare/, /sb-1117/): the newest
//   verification date across VERIFIED fee items — the same scope the
//   homepage "last verified" trust line already displays.
// - /changes/: the newest entry date in the fee change log itself.
// - Listing pages (/posts/, /archives/): the newest post actually listed
//   (publish time passed, same rule as postFilter.ts) — a future-dated
//   post must not set the listing's lastmod to a date in the future.
// - Static content pages (/about/ etc.): no frontmatter date exists, so the
//   last committed change to the page's source file is the honest date.
//   Git may be unavailable in some build environments (shallow clone, no
//   git); then the page keeps no lastmod rather than an invented date.
const toISODate = (t: number) =>
  t > 0 ? new Date(t).toISOString() : undefined;

const pageLastmod = new Map<string, string>();
for (const j of feesData.jurisdictions) {
  const t = parseVerified(j.last_verified as string);
  // A last_verified dated in the future (e.g. set to a scheduled post's
  // publication slot: Alhambra 27 Nov 2026, Ontario 24 Nov 2026,
  // Westminster 21 Nov 2026) is not a modification that has happened yet,
  // and a future <lastmod> is invalid — those pages keep no lastmod until
  // the date passes. Fixing the stored date itself is a data task, not
  // this change.
  if (!t || t > Date.now()) continue;
  const iso = toISODate(t);
  if (!iso) continue;
  const slug = (j.juris_id as string).toLowerCase();
  pageLastmod.set(`/fees/${slug}/`, iso);
  pageLastmod.set(`/sb-1117/${slug}/`, iso);
}
const latestVerifiedISO = toISODate(
  Math.max(
    ...feesData.fee_items
      .filter((i: { status: string }) => i.status === "verified")
      .map((i: { last_verified: string }) =>
        parseVerified(i.last_verified ?? "")
      )
  )
);
if (latestVerifiedISO) {
  for (const p of ["/", "/fee-index/", "/fees/", "/compare/", "/sb-1117/"]) {
    pageLastmod.set(p, latestVerifiedISO);
  }
}
const changelog = JSON.parse(
  readFileSync("./src/data/fee-changelog.json", "utf8")
);
const latestChangelogISO = toISODate(
  Math.max(
    ...changelog.entries.map((e: { date: string }) => Date.parse(e.date))
  )
);
if (latestChangelogISO) pageLastmod.set("/changes/", latestChangelogISO);
const margin = config.posts?.scheduledPostMargin ?? 15 * 60 * 1000;
const latestPostISO = toISODate(
  Math.max(...publishedPostPub.filter(t => Date.now() > t - margin))
);
if (latestPostISO) {
  pageLastmod.set("/posts/", latestPostISO);
  pageLastmod.set("/archives/", latestPostISO);
}
const gitDate = (file: string): string | undefined => {
  try {
    const out = execSync(`git log -1 --format=%cI -- ${file}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return toISODate(Date.parse(out));
  } catch {
    return undefined;
  }
};
for (const slug of [
  "about",
  "benchmarks",
  "contact",
  "corrections",
  "disclaimer",
  "methodology",
  "privacy",
  "terms",
  "worksheet",
]) {
  const d = gitDate(`src/content/pages/${slug}.md`);
  if (d) pageLastmod.set(`/${slug}/`, d);
}

export default defineConfig({
  site: config.site.url,
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        (config.features?.showArchives !== false ||
          !page.endsWith("/archives/")) &&
        !isThinPage(new URL(page).pathname) &&
        !zeroRowFeePages.has(new URL(page).pathname) &&
        !noindexSB1117Pages.has(new URL(page).pathname),
      serialize: item => {
        const pathname = new URL(item.url).pathname;
        const lastmod = postLastmod.get(pathname) ?? pageLastmod.get(pathname);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
