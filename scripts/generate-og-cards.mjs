#!/usr/bin/env node
/**
 * Generate per-jurisdiction shareable OG cards (1200x630 PNG) for
 * /fees/{city}/ and /sb-1117/{city}/, from fees.json at build time.
 *
 * Runs in `npm run build` before `astro build`, so the PNGs are in
 * public/images/og/ when Astro copies public/ to dist/. Generated files are
 * build artifacts (gitignored) — the numbers come from the data module
 * (scripts/og-cards-data.ts), which reuses the same feeCalc/sb1117Pages
 * engine as the pages, so cards can never drift from the site.
 *
 * Visual language follows the existing Pinterest cards
 * (public/images/pinterest/*.svg): navy #212737, orange #ff6b01, DejaVu Sans.
 * Set OG_CARDS_KEEP_SVG=1 to also write the source SVGs next to the PNGs.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "images", "og");
const keepSvg = process.env.OG_CARDS_KEEP_SVG === "1";

const W = 1200;
const H = 630;
const FONT = "DejaVu Sans, Helvetica, Arial, sans-serif";

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Rough DejaVu Sans width estimate (em per char) so long names/values fit. */
function fitSize(text, maxWidth, start, min, factor) {
  let size = start;
  while (size > min && text.length * factor * size > maxWidth) size -= 1;
  return size;
}

function renderCard(c) {
  const nameSize = fitSize(c.name, 1080, 56, 36, 0.62);
  const cards = [
    { label: "VERIFIED FEES", ...c.floor },
    { label: "750 SQ FT CLIFF", ...c.cliff },
    { label: "SB 1117 SAVING · 2027", ...c.saving },
  ];
  const xs = [60, 436, 812];
  const cardW = 352;
  const cardY = 195;
  const cardH = 235;
  const isMoney = (v) => v.startsWith("$");

  const blocks = cards
    .map((s, i) => {
      const x = xs[i];
      const valueSize = fitSize(s.value, cardW - 48, 44, 28, 0.66);
      const subSize = fitSize(s.sub, cardW - 48, 16, 13, 0.55);
      const valueFill = isMoney(s.value) ? "#ff6b01" : "#eaedf3";
      return [
        `<rect x="${x}" y="${cardY}" width="${cardW}" height="${cardH}" rx="12" fill="#343f60"/>`,
        `<text x="${x + 24}" y="${cardY + 42}" font-family="${FONT}" font-size="16" letter-spacing="2" fill="#afb9ca">${esc(s.label)}</text>`,
        `<text x="${x + 24}" y="${cardY + 122}" font-family="${FONT}" font-size="${valueSize}" font-weight="700" fill="${valueFill}">${esc(s.value)}</text>`,
        `<text x="${x + 24}" y="${cardY + 172}" font-family="${FONT}" font-size="${subSize}" fill="#eaedf3">${esc(s.sub)}</text>`,
      ].join("");
    })
    .join("");

  const verifiedLine = c.verifiedISO
    ? `Verified ${c.verifiedISO}`
    : "Verification in progress";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#212737"/>
<rect width="${W}" height="8" fill="#ff6b01"/>
<text x="60" y="88" font-family="${FONT}" font-size="${nameSize}" font-weight="700" fill="#ffffff">${esc(c.name)}</text>
<text x="60" y="130" font-family="${FONT}" font-size="24" fill="#afb9ca">California ADU fees · 800 sq ft detached ADU</text>
<line x1="60" y1="162" x2="1140" y2="162" stroke="#343f60" stroke-width="2"/>
${blocks}
<line x1="60" y1="475" x2="1140" y2="475" stroke="#ff6b01" stroke-width="4"/>
<text x="60" y="525" font-family="${FONT}" font-size="28" font-weight="700" fill="#ff6b01">Every Line Item</text>
<text x="60" y="560" font-family="${FONT}" font-size="22" fill="#afb9ca">everylineitem.com</text>
<text x="1140" y="525" text-anchor="end" font-family="${FONT}" font-size="20" fill="#afb9ca">${esc(verifiedLine)}</text>
<text x="1140" y="560" text-anchor="end" font-family="${FONT}" font-size="20" fill="#afb9ca">Sources: official fee schedules</text>
</svg>`;
}

const started = Date.now();

// Bundle the TS data module (it imports feeCalc/sb1117Pages/fees.json) and run it.
const bundlePath = path.join(os.tmpdir(), `og-cards-data-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, "scripts", "og-cards-data.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
  logLevel: "silent",
});
const { computeOgCards } = await import(bundlePath);
const cards = computeOgCards();
await fs.promises.rm(bundlePath, { force: true });

// Fresh output dir: drop stale cards from removed jurisdictions.
await fs.promises.rm(outDir, { recursive: true, force: true });
await fs.promises.mkdir(outDir, { recursive: true });

let n = 0;
let labelStats = 0;
// Rasterize with a small worker pool: sharp releases the event loop while
// encoding, so sequential awaits would waste most of the wall time.
const CONCURRENCY = 6;
let idx = 0;
async function worker() {
  while (idx < cards.length) {
    const c = cards[idx++];
    const svg = renderCard(c);
    const pngPath = path.join(outDir, `${c.slug}.png`);
    await sharp(Buffer.from(svg), { density: 72 })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    if (keepSvg) {
      await fs.promises.writeFile(
        path.join(outDir, `${c.slug}.svg`),
        svg,
        "utf8"
      );
    }
    for (const s of [c.floor, c.cliff, c.saving]) {
      if (!s.value.startsWith("$")) labelStats++;
    }
    n++;
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const thin = cards.filter((c) => c.thin).length;
const noVerified = cards.filter((c) => c.verifiedISO === null).length;
console.log(
  `generate-og-cards: ${n} card(s) in ${((Date.now() - started) / 1000).toFixed(1)}s ` +
    `(${thin} thin pages, ${noVerified} with no verified rows, ` +
    `${labelStats} label-instead-of-number stats)`
);
