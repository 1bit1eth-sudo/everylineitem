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
import config from "./astro-paper.config";
import { readdirSync, readFileSync } from "node:fs";

// Post URL -> last modified date (modDatetime, else pubDatetime), read from
// frontmatter so sitemap entries carry an accurate <lastmod>.
const postLastmod = new Map<string, string>();
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
      const chargesImpact = runs.some(
        r => (r.currentHigh ?? r.currentLow) > 0
      );
      return !hasImpact || !chargesImpact;
    })
    .map((j: { juris_id: string }) => `/sb-1117/${j.juris_id.toLowerCase()}/`)
);

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
        const lastmod = postLastmod.get(new URL(item.url).pathname);
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
