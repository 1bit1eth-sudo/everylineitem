/**
 * /llms.txt — generated at build time so it never falls behind the site.
 *
 * Lists every jurisdiction fee page (from fees.json) and every published
 * post (from the posts collection), so AI search tools can find the page
 * that answers a city-level ADU fee question. Fee totals are printed only
 * for jurisdictions whose status is "verified" and whose total rests on at
 * least MIN_VERIFIED_LINES verified fee lines; others are listed without a
 * number.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import feesData from "@/data/fees.json";
import { jurisStack, fmtUSD } from "@/lib/feeCalc";
import { formatVerified } from "@/utils/formatVerified";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

const SQFT = 800;
const MIN_VERIFIED_LINES = 3;
const REGION_ORDER = ["SoCal", "Bay Area", "NorCal", "Central Coast"];

const trimDesc = (s: string, max = 160): string => {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—–-]+$/, "") + "…";
};

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL(config.site.url)).href.replace(/\/$/, "");
  const abs = (path: string) =>
    `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const posts = getSortedPosts(await getCollection("posts"));
  const postIds = new Set(posts.map(p => p.id));

  const jurisdictions = (feesData.jurisdictions as any[]).filter(
    j => j.juris_id !== "LA-BASE" // synthetic series baseline, not a real jurisdiction
  );
  // A post_slug shared by many jurisdictions is a generic fallback guide
  // (e.g. the soft-costs explainer), not a city post. Only slugs used by
  // at most two jurisdictions count as that city's own post.
  const slugUse = new Map<string, number>();
  for (const j of jurisdictions) {
    if (j.post_slug)
      slugUse.set(j.post_slug, (slugUse.get(j.post_slug) ?? 0) + 1);
  }
  const cityPostIds = new Set(
    [...slugUse.entries()]
      .filter(([slug, n]) => n <= 2 && postIds.has(slug))
      .map(([slug]) => slug)
  );

  const feeLine = (j: any): string => {
    const url = abs(`/fees/${j.juris_id.toLowerCase()}/`);
    const parts: string[] = [`${j.county} County, ${j.region}.`];
    const stack = jurisStack(feesData as any, j.juris_id, SQFT);
    // Same rule as /fee-index/: a total is printed only when it rests on
    // at least MIN_VERIFIED_LINES verified lines, so an AI answer never
    // quotes a near-empty schedule as the city's fee.
    if (j.status === "verified" && stack.count >= MIN_VERIFIED_LINES) {
      const amount = stack.area
        ? `Up to ${fmtUSD(stack.total)}`
        : fmtUSD(stack.total);
      parts.push(
        `${amount} in verified flat and per-sq-ft fee lines for an ${SQFT} sq ft detached ADU (valuation-based permit fees not included), checked ${formatVerified(j.last_verified)}.`
      );
    } else {
      parts.push("Fee lines listed; total not yet fully verified.");
    }
    if (j.post_slug && cityPostIds.has(j.post_slug)) {
      parts.push(`City cost post: ${abs(`/posts/${j.post_slug}/`)}`);
    }
    return `- [${j.name} ADU fees](${url}): ${parts.join(" ")}`;
  };

  const regions = [
    ...REGION_ORDER,
    ...new Set(
      jurisdictions.map(j => j.region).filter(r => !REGION_ORDER.includes(r))
    ),
  ];
  const feeSections = regions
    .map(region => {
      const rows = jurisdictions
        .filter(j => j.region === region)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length === 0) return "";
      return `### ${region} (${rows.length})\n\n${rows.map(feeLine).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const guides = posts
    .filter(p => !cityPostIds.has(p.id))
    .map(
      p =>
        `- [${p.data.title}](${abs(getPostUrl(p.id, p.filePath))}): ${trimDesc(p.data.description)}`
    )
    .join("\n");

  const body = `# Every Line Item

> Line-item cost breakdowns for California ADUs — every phase priced so you can see where the money goes. Government fee data for ${jurisdictions.length} California cities and counties, each line linked to the official fee schedule.

Site: ${abs("/")}

## Primary pages

- [Home](${abs("/")}): Series overview and featured posts
- [ADU fees by city](${abs("/fees/")}): Every jurisdiction's ADU permit, plan check, impact and school fees, line by line
- [Fee index](${abs("/fee-index/")}): All jurisdictions ranked by total government fees for the same ADU
- [Compare builds](${abs("/compare/")}): Side-by-side six-phase ADU cost comparison (default 800 vs 400 sq ft)
- [SB 1117](${abs("/sb-1117/")}): How each jurisdiction's fees change when the 750 sq ft cliff goes away
- [Methodology](${abs("/methodology/")}): How figures are built (public sources; no paywalled RSMeans)
- [Benchmarks](${abs("/benchmarks/")}): Regional phase ranges
- [Worksheet](${abs("/worksheet/")}): Blank six-phase CSV ledger
- [Corrections](${abs("/corrections/")}): Change log
- [About](${abs("/about/")}): Why six phases

## ADU fees by jurisdiction

${feeSections}

## Guides and explainers

${guides}

## Optional

- [Posts index](${abs("/posts/")})
- [Fee index CSV](${abs("/downloads/adu-fee-index-latest.csv")})
- [Sitemap](${abs("/sitemap-index.xml")})
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
