#!/usr/bin/env node
/**
 * Decode public/images/pinterest/*.png.b64 -> *.png before Astro build.
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

let n = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".png.b64")) continue;
  const b64Path = path.join(dir, name);
  const pngPath = path.join(dir, name.slice(0, -4)); // strip .b64 -> .png
  const buf = Buffer.from(fs.readFileSync(b64Path, "utf8").trim(), "base64");
  fs.writeFileSync(pngPath, buf);
  console.log("decoded", path.relative(root, pngPath), buf.length, "bytes");
  n++;
}
console.log(`decode-pinterest-pins: ${n} file(s)`);
