#!/usr/bin/env node
/**
 * Prepare public/images/pinterest/*.png before Astro build.
 * 1) Decode *.png.b64 (or split *.png.b64.NN) -> *.png
 * 2) Else rasterize matching *.svg via sharp -> *.png
 * PNGs may be stored as base64 text because GitHub MCP corrupts binary uploads.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "images", "pinterest");

if (!fs.existsSync(dir)) {
  console.log("decode-pinterest-pins: no directory", dir);
  process.exit(0);
}

const names = fs.readdirSync(dir);
let n = 0;

// 1) Monolithic *.png.b64
for (const name of names) {
  if (!name.endsWith(".png.b64")) continue;
  const b64Path = path.join(dir, name);
  const pngPath = path.join(dir, name.slice(0, -4)); // strip .b64 -> .png
  const buf = Buffer.from(fs.readFileSync(b64Path, "utf8").trim(), "base64");
  fs.writeFileSync(pngPath, buf);
  console.log("decoded", path.relative(root, pngPath), buf.length, "bytes");
  n++;
}

// 2) Split parts: basename.png.b64.00, .01, ...
const partRe = /^(.*\.png\.b64)\.(\d+)$/;
const groups = new Map();
for (const name of names) {
  const m = name.match(partRe);
  if (!m) continue;
  const base = m[1];
  if (names.includes(base)) continue;
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push({ name, idx: parseInt(m[2], 10) });
}
for (const [base, parts] of groups) {
  parts.sort((a, b) => a.idx - b.idx);
  const text = parts.map((p) => fs.readFileSync(path.join(dir, p.name), "utf8")).join("");
  const pngPath = path.join(dir, base.slice(0, -4));
  const buf = Buffer.from(text.trim(), "base64");
  fs.writeFileSync(pngPath, buf);
  console.log("decoded(parts)", path.relative(root, pngPath), buf.length, "bytes", `(${parts.length} parts)`);
  n++;
}

// 3) SVG fallback when no PNG yet
const names2 = fs.readdirSync(dir);
for (const name of names2) {
  if (!name.endsWith(".svg")) continue;
  const pngName = name.slice(0, -4) + ".png";
  const pngPath = path.join(dir, pngName);
  if (fs.existsSync(pngPath)) continue;
  const svgPath = path.join(dir, name);
  const svg = fs.readFileSync(svgPath);
  await sharp(svg, { density: 144 }).png().toFile(pngPath);
  const st = fs.statSync(pngPath);
  console.log("rasterized", path.relative(root, pngPath), st.size, "bytes");
  n++;
}

console.log(`decode-pinterest-pins: ${n} file(s)`);
