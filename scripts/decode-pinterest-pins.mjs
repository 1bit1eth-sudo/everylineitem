#!/usr/bin/env node
/**
 * Decode public/images/pinterest/*.png.b64 -> *.png before Astro build.
 * Also supports split uploads: foo.png.b64.00 + foo.png.b64.01 + ... -> foo.png
 * PNGs are stored as base64 text because GitHub MCP corrupts binary uploads.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const base = m[1]; // includes .png.b64
  if (names.includes(base)) continue; // prefer monolithic
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push({ name, idx: parseInt(m[2], 10) });
}
for (const [base, parts] of groups) {
  parts.sort((a, b) => a.idx - b.idx);
  const text = parts.map((p) => fs.readFileSync(path.join(dir, p.name), "utf8")).join("");
  const pngPath = path.join(dir, base.slice(0, -4)); // strip .b64
  const buf = Buffer.from(text.trim(), "base64");
  fs.writeFileSync(pngPath, buf);
  console.log("decoded(parts)", path.relative(root, pngPath), buf.length, "bytes", `(${parts.length} parts)`);
  n++;
}

console.log(`decode-pinterest-pins: ${n} file(s)`);
