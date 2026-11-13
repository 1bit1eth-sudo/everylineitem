// Build-time per-jurisdiction estimate .xlsx export (no new dependencies).
// One file per jurisdiction with at least one verified fee line:
// public/downloads/estimate-<slug>.xlsx
// Uses the same calcJurisdiction math as the fee pages, so the sheet can
// never disagree with the site. Amounts are real numbers (not text) so the
// file works as a spreadsheet. Called from astro.config.ts next to the CSV
// export. The minimal .xlsx writer below uses only node:zlib + node:fs:
// a single "Estimate" sheet, inline strings (no sharedStrings table), and
// currency number formats. Files are build artifacts — gitignored — so they
// are always regenerated from the current fees.json and never go stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import {
  calcJurisdiction,
  categoryLabel,
  type FeeData,
  type FeeItem,
} from "./feeCalc";
import { csvExportDate, csvRateLabel } from "./csvExport";

// The 6-step model, carried from the Los Angeles County baseline — the same
// figures every city post uses. Construction phases are not city-specific:
// no city in the series publishes phase-level construction costs.
const CONSTRUCTION_STEPS: Array<[string, number]> = [
  ["Site work + foundation", 38000],
  ["Framing + structure", 48000],
  ["Building envelope", 42000],
  ["Systems + interior", 147000],
  ["Landscaping & hardscape", 13000],
];
const CONSTRUCTION_SUBTOTAL = 288000;
const DESIGN_COST = 14000;
const SQFT = 800;

const money = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// --- minimal ZIP writer (stored + deflated entries, no extra fields) ---

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

interface ZipEntry {
  name: string;
  data: Buffer;
}

function zipFiles(entries: ZipEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 filenames
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, compressed);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralDir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralDir, end]);
}

// --- sheet model ---

type Cell =
  | { t: "s"; v: string; bold?: boolean; title?: boolean }
  | { t: "n"; v: number; bold?: boolean };

const COLS = ["A", "B", "C", "D", "E", "F"];
const COL_WIDTHS = [46, 20, 18, 34, 52, 14];

function sheetXml(rows: Cell[][]): string {
  // style indices: 0 normal, 1 bold, 2 title, 3 $#,##0, 4 $#,##0.00, 5 $#,##0 bold
  const cellXml = (rowIdx: number, colIdx: number, cell: Cell): string => {
    const ref = `${COLS[colIdx]}${rowIdx}`;
    if (cell.t === "s") {
      const s = cell.title ? 2 : cell.bold ? 1 : 0;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${esc(cell.v)}</t></is></c>`;
    }
    const s = cell.bold ? 5 : Number.isInteger(cell.v) ? 3 : 4;
    return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
  };
  const rowsXml = rows
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row
          .map((cell, j) => cellXml(i + 1, j, cell))
          .join("")}</row>`
    )
    .join("");
  const colsXml = COL_WIDTHS.map(
    (w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}"/>`
  ).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${colsXml}</cols><sheetData>${rowsXml}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts><numFmt numFmtId="164" formatCode="$#,##0"/><numFmt numFmtId="165" formatCode="$#,##0.00"/></numFmts>` +
  `<fonts><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="13"/><name val="Calibri"/></font></fonts>` +
  `<fills><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0"/>` +
  `</cellXfs>` +
  `<cellStyles><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Estimate" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function buildXlsx(rows: Cell[][]): Buffer {
  return zipFiles([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(CONTENT_TYPES_XML, "utf8"),
    },
    { name: "_rels/.rels", data: Buffer.from(RELS_XML, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(WORKBOOK_XML, "utf8") },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(WORKBOOK_RELS_XML, "utf8"),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from(sheetXml(rows), "utf8"),
    },
    { name: "xl/styles.xml", data: Buffer.from(STYLES_XML, "utf8") },
  ]);
}

// --- estimate rows ---

const S = (v: string, bold = false): Cell => ({ t: "s", v, bold });
const TITLE = (v: string): Cell => ({ t: "s", v, title: true });
const N = (v: number, bold = false): Cell => ({ t: "n", v, bold });
const BLANK: Cell[] = [
  { t: "s", v: "" },
  { t: "s", v: "" },
  { t: "s", v: "" },
  { t: "s", v: "" },
  { t: "s", v: "" },
  { t: "s", v: "" },
];
const HEADER: Cell[] = [
  S("Item", true),
  S("Category", true),
  S("Amount (USD)", true),
  S("Rate / basis", true),
  S("Source", true),
  S("Last verified", true),
];

function rateText(item: FeeItem): string {
  const label = csvRateLabel(item);
  return label === "" ? "see fee schedule" : label;
}

function estimateRows(
  jurisName: string,
  area: string | null,
  verified: Array<{ item: FeeItem; low: number; high: number | null }>,
  skipped: FeeItem[],
  pending: FeeItem[],
  date: string
): Cell[][] {
  const verifiedLow = verified.reduce((s, l) => s + l.low, 0);
  const softSubtotal = DESIGN_COST + verifiedLow;
  const rawTotal = CONSTRUCTION_SUBTOTAL + softSubtotal;
  const total = Math.round(rawTotal / 1000) * 1000;
  const perSqft = Math.floor(total / SQFT);
  const rows: Cell[][] = [
    [TITLE(`${jurisName} ADU Estimate — ${SQFT} sq ft`)],
    [
      S(
        `Model estimate, not a quote · Generated ${date} (KST) · everylineitem.com`
      ),
    ],
    BLANK,
    HEADER,
    [S("CONSTRUCTION", true)],
  ];
  for (const [name, amount] of CONSTRUCTION_STEPS) {
    rows.push([S(name), S("Construction"), N(amount), S("Series baseline")]);
  }
  rows.push([
    S("Subtotal — construction", true),
    S(""),
    N(CONSTRUCTION_SUBTOTAL, true),
  ]);
  rows.push(BLANK);
  rows.push([S("SOFT COSTS", true)]);
  rows.push([
    S("Design & engineering"),
    S("Soft cost"),
    N(DESIGN_COST),
    S("Series baseline"),
  ]);
  for (const line of verified) {
    const range =
      line.high != null && line.high !== line.low
        ? `Range ${money(line.low)}–${money(line.high)}`
        : rateText(line.item);
    rows.push([
      S(line.item.fee_name ?? ""),
      S(categoryLabel(line.item.category ?? "")),
      N(line.low),
      S(range),
      S(line.item.source_url ?? ""),
      S(line.item.last_verified ?? ""),
    ]);
  }
  rows.push([S("Subtotal — soft costs", true), S(""), N(softSubtotal, true)]);
  rows.push(BLANK);
  rows.push([S(`TOTAL — ${SQFT} sq ft ADU *`, true), S(""), N(total, true)]);
  rows.push([S("$ per sq ft", true), S(""), N(perSqft, true)]);
  rows.push(BLANK);
  if (skipped.length > 0) {
    rows.push([
      S(
        "VERIFIED RATES — no dollar amount (needs your project's valuation)",
        true
      ),
    ]);
    for (const item of skipped) {
      rows.push([
        S(item.fee_name ?? ""),
        S(categoryLabel(item.category ?? "")),
        S("—"),
        S(rateText(item)),
        S(item.source_url ?? ""),
        S(item.last_verified ?? ""),
      ]);
    }
    rows.push(BLANK);
  }
  if (pending.length > 0) {
    rows.push([
      S("NOT INCLUDED — not verified yet (verify with city / district)", true),
    ]);
    for (const item of pending) {
      rows.push([
        S(item.fee_name ?? ""),
        S(categoryLabel(item.category ?? "")),
        S("—"),
        S(rateText(item)),
        S(item.source_url ?? ""),
        S(item.last_verified ?? ""),
      ]);
    }
    rows.push(BLANK);
  }
  rows.push([
    S(
      "* Floor, not total: unverified fees are excluded; the total rises when they are confirmed."
    ),
  ]);
  rows.push([
    S(
      `Construction costs are the Los Angeles County baseline carried across cities — ${jurisName} does not publish phase-level construction costs.`
    ),
  ]);
  rows.push([
    S(
      "Fees are verified line items from official sources only. Source links and last-verified dates are in the Source and Last verified columns."
    ),
  ]);
  if (area) {
    rows.push([
      S(
        `Area: this sheet uses the ${area} schedule (the site default). A parcel pays one area's schedule, not both.`
      ),
    ]);
  }
  rows.push([
    S(
      `${SQFT} sq ft detached ADU, single-story, new construction, mid-grade finishes. Design $14,000 is the series baseline.`
    ),
  ]);
  rows.push([
    S(
      "Model estimate, not a quote. Confirm figures with the city or district before budgeting."
    ),
  ]);
  return rows;
}

export function generateEstimateXlsxFiles(feesData: FeeData): {
  files: string[];
  jurisdictions: number;
} {
  const date = csvExportDate();
  mkdirSync("public/downloads", { recursive: true });
  const files: string[] = [];
  for (const juris of feesData.jurisdictions) {
    if (juris.juris_id === "LA-BASE") continue;
    // Same predicate the fee page's download button uses: the default-area
    // result (alphabetically first area) has a verified line with an amount.
    const result = calcJurisdiction(feesData, juris.juris_id, SQFT);
    const verified = result.lines
      .filter(l => l.item.status === "verified" && l.kind !== "skipped")
      .map(l => ({ item: l.item, low: l.low, high: l.high }));
    if (verified.length === 0) continue;
    const skipped = result.lines
      .filter(l => l.item.status === "verified" && l.kind === "skipped")
      .map(l => l.item);
    const pending = result.lines
      .filter(
        l =>
          (l.item.status === "to_verify" || l.item.status === "conflict") &&
          l.kind !== "skipped"
      )
      .map(l => l.item);
    const rows = estimateRows(
      juris.name,
      result.area,
      verified,
      skipped,
      pending,
      date
    );
    const name = `estimate-${juris.juris_id.toLowerCase()}.xlsx`;
    writeFileSync(`public/downloads/${name}`, buildXlsx(rows));
    files.push(name);
  }
  return { files, jurisdictions: files.length };
}
