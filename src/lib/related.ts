import type { CollectionEntry } from "astro:content";
import { getPostUrl } from "@/utils/getPostPaths";
import { slugifyStr } from "@/utils/slugify";
import config from "@/config";

export type Post = CollectionEntry<"posts">;

export type Link = { href: string; label: string };

/** Frontmatter tags are inconsistent ("adu bid" vs "adu-bid", "soft costs"
 * vs "soft-costs"), so every tag comparison normalises to its slug first. */
const normTags = (post: Post): string[] =>
  (post.data.tags ?? []).map(t => slugifyStr(t));

/** Tool link (labelled the way the site already labels it elsewhere). */
export const TOOLS: Record<string, Link> = {
  compare: { href: "/compare/", label: "Calculate your exact fees" },
  "property-tax": {
    href: "/property-tax/",
    label: "Estimate the added property tax",
  },
  "bid-scanner": {
    href: "/bid-scanner/",
    label: "Check your ADU quote line by line",
  },
  worksheet: { href: "/worksheet/", label: "Download the blank ledger" },
};

/**
 * The tool a post points at (content-loop device B), picked from the post's
 * own tags. Order matters: a post tagged property-tax goes to the tax
 * calculator even if it is also tagged adu-cost.
 */
export function toolForPost(post: Post): Link {
  const tags = normTags(post);
  if (tags.includes("property-tax") || tags.includes("prop-13"))
    return TOOLS["property-tax"];
  if (
    tags.includes("adu-bid") ||
    tags.includes("contractor-bid") ||
    tags.includes("contractor") ||
    tags.includes("adu-quote")
  )
    return TOOLS["bid-scanner"];
  if (tags.includes("soft-costs")) return TOOLS.worksheet;
  return TOOLS.compare;
}

function postLink(post: Post): Link {
  return {
    href: getPostUrl(post.id, post.filePath, config.site.lang),
    label: post.data.title,
  };
}

function byRecency(a: Post, b: Post) {
  return (
    Math.floor(
      new Date(b.data.modDatetime ?? b.data.pubDatetime).getTime() / 1000
    ) -
    Math.floor(
      new Date(a.data.modDatetime ?? a.data.pubDatetime).getTime() / 1000
    )
  );
}

/**
 * Posts related to `current`, ranked by shared-tag count, then recency.
 * Only tags the posts themselves carry are used — no hand-written list.
 */
export function relatedByTags(
  posts: Post[],
  current: Post,
  n: number
): Link[] {
  const currentTags = new Set(normTags(current));
  return posts
    .filter(p => p.id !== current.id)
    .map(p => ({
      post: p,
      shared: normTags(p).filter(t => currentTags.has(t)).length,
    }))
    .filter(({ shared }) => shared > 0)
    .sort(
      (a, b) => b.shared - a.shared || byRecency(a.post, b.post)
    )
    .slice(0, n)
    .map(({ post }) => postLink(post));
}

/**
 * Posts a tool page points at (content-loop device B, reverse direction).
 * Primary tag per tool, filled with the most recent adu-cost posts so every
 * tool page has at least two related posts.
 */
export function postsForTool(
  posts: Post[],
  tool: "compare" | "property-tax" | "worksheet",
  n: number
): Link[] {
  const primary: Record<typeof tool, string[]> = {
    compare: ["comparison"],
    "property-tax": ["property-tax"],
    worksheet: ["soft-costs"],
  };
  const tags = primary[tool];
  const picked: Post[] = [];
  for (const p of [...posts].sort(byRecency)) {
    if (picked.length >= n) break;
    if (normTags(p).some(t => tags.includes(t))) picked.push(p);
  }
  for (const p of [...posts].sort(byRecency)) {
    if (picked.length >= n) break;
    if (picked.includes(p)) continue;
    if (normTags(p).includes("adu-cost")) picked.push(p);
  }
  return picked.map(postLink);
}

/**
 * Site-information pages, in footer-nav order. Used as the "same hub" group
 * for the static pages' next-read block (content-loop devices A + E).
 */
export const SITE_INFO_PAGES: Link[] = [
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
  { href: "/corrections/", label: "Corrections" },
  { href: "/disclaimer/", label: "Disclaimer" },
  { href: "/methodology/", label: "Methodology" },
  { href: "/privacy/", label: "Privacy Policy" },
  { href: "/terms/", label: "Terms of Use" },
];

/** Neighbouring site-information pages (previous / next in footer order). */
export function siteInfoNeighbors(href: string): Link[] {
  const idx = SITE_INFO_PAGES.findIndex(p => p.href === href);
  if (idx < 0) return [];
  const out: Link[] = [];
  if (idx > 0) out.push(SITE_INFO_PAGES[idx - 1]);
  if (idx < SITE_INFO_PAGES.length - 1) out.push(SITE_INFO_PAGES[idx + 1]);
  return out;
}

/** Next-read links for a site-information page: neighbours, padded with the
 * Fee Index so the block always has two text links (plus the tool button). */
export function siteInfoNextReads(href: string): Link[] {
  const links = siteInfoNeighbors(href);
  if (links.length < 2)
    links.push({ href: "/fee-index/", label: "California ADU Fee Index" });
  return links;
}
