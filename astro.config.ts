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
  /^\/search\/?$/.test(pathname);

export default defineConfig({
  site: config.site.url,
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        (config.features?.showArchives !== false ||
          !page.endsWith("/archives/")) &&
        !isThinPage(new URL(page).pathname),
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
