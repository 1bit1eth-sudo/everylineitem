#!/usr/bin/env node
/**
 * Always regenerate public/images/pinterest/*.png from matching *.svg via sharp.
 * Used by CI to commit real PNGs so Cloudflare Pages can serve them without
 * relying on build-time decode.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "images", "pinterest");

if (!fs.existsSync(dir)) {
  console.error("generate-pinterest-pngs: missing", dir);
  process.exit(1);
}

let n = 0;
for (const name of fs.readdirSync(dir).sort()) {
  if (!name.endsWith(".svg")) continue;
  const svgPath = path.join(dir, name);
  const pngPath = path.join(dir, name.slice(0, -4) + ".png");
  // density 72 -> native 1000x1500 from SVG width/height
  await sharp(fs.readFileSync(svgPath), { density: 72 })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);
  const st = fs.statSync(pngPath);
  console.log("wrote", path.relative(root, pngPath), st.size, "bytes");
  n++;
}

if (n === 0) {
  console.error("generate-pinterest-pngs: no SVGs found in", dir);
  process.exit(1);
}

console.log(`generate-pinterest-pngs: ${n} file(s)`);
