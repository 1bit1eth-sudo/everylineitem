// Structured data + PDF rendering for the /compare/ "Email me this report"
// lead magnet. Pure functions over feeCalc results; jsPDF is imported
// dynamically by the caller so the ~350KB library only loads on demand.

import {
  calcJurisdiction,
  categoryLabel,
  fmtRange,
  type CalcLine,
  type FeeData,
} from "./feeCalc";

export interface ReportLine {
  feeName: string;
  category: string;
  /** Display amount, e.g. "$1,234", "$1,000–$1,500", "$0 exempt", "—". */
  amountText: string;
  /** Plain-text note (exempt reason / skipped reason / item notes). */
  note: string | null;
  sourceUrl: string | null;
  sourceNote: string | null;
}

export interface FeeReport {
  jurisName: string;
  jurisId: string;
  county: string;
  sqft: number;
  generatedAt: string; // ISO date, e.g. "2026-10-09"
  totalText: string;
  impactText: string;
  cliffText: string;
  lines: ReportLine[];
  skippedCount: number;
  skippedNote: string | null;
  postSlug: string;
  feeScheduleUrl: string;
  lastVerified: string;
  status: string;
}

function lineAmountText(l: CalcLine): string {
  if (l.kind === "skipped") return "—";
  if (l.kind === "exempt") return "$0 (exempt)";
  return fmtRange(l.low, l.high);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

/** Plain-text version of the 750 sq ft cliff callout. */
export function cliffPlainText(data: FeeData, jurisId: string): string {
  const at750 = calcJurisdiction(
    data,
    jurisId,
    data.rules.impact_exempt_max_sqft
  );
  const at751 = calcJurisdiction(
    data,
    jurisId,
    data.rules.impact_exempt_max_sqft + 1
  );
  const r = calcJurisdiction(data, jurisId, at750.sqft);
  const hasImpactItems = r.lines.some(
    l => l.item.category === "impact" && l.kind !== "skipped"
  );
  if (!hasImpactItems) {
    return "No impact-fee line items are on file for this jurisdiction yet, so the 750 sq ft cliff does not move its total.";
  }
  const deltaLow = at751.totalLow - at750.totalLow;
  const deltaHigh =
    at751.totalHigh != null && at750.totalHigh != null
      ? at751.totalHigh - at750.totalHigh
      : null;
  return (
    `At ${data.rules.impact_exempt_max_sqft} sq ft, this jurisdiction's impact fees are ` +
    `${fmtRange(at750.impactLow, at750.impactHigh)} — state law bars them. ` +
    `At ${data.rules.impact_exempt_max_sqft + 1} sq ft they become ` +
    `${fmtRange(at751.impactLow, at751.impactHigh)}, and the fee total jumps by about ` +
    `${fmtRange(deltaLow, deltaHigh)}.`
  );
}

export function buildFeeReport(
  data: FeeData,
  jurisId: string,
  sqft: number
): FeeReport {
  const r = calcJurisdiction(data, jurisId, sqft);
  const lines: ReportLine[] = r.lines.map(l => ({
    feeName: l.item.fee_name,
    category: categoryLabel(l.item.category),
    amountText: lineAmountText(l),
    note:
      l.reason ??
      (l.item.notes && l.kind !== "skipped" ? l.item.notes : null),
    sourceUrl: l.item.source_url,
    sourceNote: l.item.source_note,
  }));
  const skippedNote =
    r.skippedCount > 0
      ? `${r.skippedCount} line item${r.skippedCount > 1 ? "s are" : " is"} excluded from the total — the fee schedule data on file does not cover ${r.skippedCount > 1 ? "them" : "it"} (marked "—" above). We do not guess missing rates.`
      : null;

  return {
    jurisName: r.juris.name,
    jurisId: r.juris.juris_id,
    county: r.juris.county,
    sqft: r.sqft,
    generatedAt: new Date().toISOString().slice(0, 10),
    totalText: fmtRange(r.totalLow, r.totalHigh),
    impactText: fmtRange(r.impactLow, r.impactHigh),
    cliffText: cliffPlainText(data, jurisId),
    lines,
    skippedCount: r.skippedCount,
    skippedNote,
    postSlug: r.juris.post_slug,
    feeScheduleUrl: r.juris.fee_schedule_url,
    lastVerified: r.juris.last_verified,
    status: r.juris.status,
  };
}

/**
 * Render the report to a PDF and trigger a download. The caller must
 * dynamically import jsPDF to keep it out of the initial bundle:
 *
 *   const { jsPDF } = await import("jspdf");
 *   downloadFeeReportPDF(jsPDF, report);
 */
export function downloadFeeReportPDF(
  JsPDFCtor: new (opts?: Record<string, unknown>) => {
    setFont(f: string, s?: string): void;
    setFontSize(n: number): void;
    setTextColor(...c: number[]): void;
    text(
      t: string | string[],
      x: number,
      y: number,
      o?: Record<string, unknown>
    ): void;
    splitTextToSize(t: string, w: number): string[];
    line(x1: number, y1: number, x2: number, y2: number): void;
    setDrawColor(...c: number[]): void;
    setFillColor(...c: number[]): void;
    rect(x: number, y: number, w: number, h: number, s?: string): void;
    addPage(): void;
    save(name: string): void;
    internal: { pageSize: { getWidth(): number; getHeight(): number } };
  },
  report: FeeReport
): void {
  const doc = new JsPDFCtor({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(); // 612
  const H = doc.internal.pageSize.getHeight(); // 792
  const M = 48; // margin
  const contentW = W - M * 2;
  let y = 56;

  const ensure = (need: number) => {
    if (y + need > H - 56) {
      doc.addPage();
      y = 56;
    }
  };

  // Header band
  doc.setFillColor(0, 108, 172);
  doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Every Line Item", M, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("ADU Fee Report — everylineitem.com", M, 48);
  y = 92;

  // Title block
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${report.jurisName} — ${report.sqft.toLocaleString("en-US")} sq ft ADU`, M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `${report.county} County · Generated ${report.generatedAt} · Fee schedule checked ${report.lastVerified}`,
    M,
    y
  );
  y += 26;

  // Total card
  ensure(70);
  doc.setFillColor(245, 247, 250);
  doc.rect(M, y - 14, contentW, 58, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("ESTIMATED FEES", M + 12, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(report.totalText, M + 12, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Impact fees included: ${report.impactText}`, M + 12, y + 44);
  y += 66;

  // 750 cliff callout
  ensure(60);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(217, 180, 84);
  const cliffLines = doc.splitTextToSize(
    `The 750 sq ft cliff: ${report.cliffText}`,
    contentW - 24
  );
  const cliffH = cliffLines.length * 13 + 22;
  doc.rect(M, y - 12, contentW, cliffH, "FD");
  doc.setTextColor(80, 60, 20);
  doc.setFontSize(10);
  doc.text(cliffLines, M + 12, y + 4);
  y += cliffH + 14;

  // Line-item table header
  ensure(30);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Fee breakdown", M, y);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, M + contentW, y);
  y += 14;

  // Table rows
  doc.setFontSize(9.5);
  const nameW = contentW * 0.52;
  const catW = contentW * 0.23;
  for (const ln of report.lines) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    const nameLines = doc.splitTextToSize(ln.feeName, nameW);
    let rowH = nameLines.length * 12;
    let noteLines: string[] = [];
    if (ln.note) {
      noteLines = doc.splitTextToSize(stripHtml(ln.note), nameW);
      rowH += noteLines.length * 11;
    }
    rowH += 10;
    ensure(rowH + 4);

    doc.text(nameLines, M, y);
    if (noteLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(8.5);
      doc.text(noteLines, M, y + nameLines.length * 12 + 2);
      doc.setFontSize(9.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const catLines = doc.splitTextToSize(ln.category, catW);
    doc.text(catLines, M + nameW + 8, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(ln.amountText, M + contentW, y, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
    doc.setDrawColor(230, 230, 230);
    doc.line(M, y - 6, M + contentW, y - 6);
  }
  y += 6;

  if (report.skippedNote) {
    ensure(40);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    const sk = doc.splitTextToSize(report.skippedNote, contentW);
    doc.text(sk, M, y);
    y += sk.length * 11 + 10;
  }

  // Disclaimer
  ensure(70);
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, M + contentW, y);
  y += 14;
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(9);
  const disc = doc.splitTextToSize(
    "This calculator applies published fee schedules — it is not a construction quote. Totals cover government fees only: no design, construction, financing, or contingency costs. Figures change; verify with your city's building division before you budget.",
    contentW
  );
  doc.text(disc, M, y);
  y += disc.length * 11 + 12;

  doc.setTextColor(0, 108, 172);
  doc.text(
    `Full breakdown: everylineitem.com/posts/${report.postSlug}/`,
    M,
    y
  );

  const fname =
    `everylineitem-fee-report-${report.jurisId.toLowerCase()}-${report.sqft}sqft.pdf`;
  doc.save(fname);
}
