import PDFDocument from "pdfkit";
import type { Response } from "express";
import { prisma } from "./prisma";

export type Doc = InstanceType<typeof PDFDocument>;

const INK = "#101828";
const MUTED = "#667085";
const LINE = "#e4e7ec";

/** Create a PDF, stream it to the response with a branded header, run `build`. */
export async function streamPdf(
  res: Response,
  opts: { filename: string; title: string; subtitle?: string },
  build: (doc: Doc, accent: string) => void
) {
  const settings = await prisma.schoolSettings.findFirst();
  const schoolName = settings?.name ?? "School";
  const accent = settings?.primaryColor || "#1d4ed8";

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${opts.filename}"`);
  doc.pipe(res);

  // Header band
  doc.rect(0, 0, doc.page.width, 6).fill(accent);
  doc.fillColor(INK).fontSize(20).font("Helvetica-Bold").text(schoolName, 48, 36);
  doc
    .fillColor(MUTED)
    .fontSize(10)
    .font("Helvetica")
    .text(settings?.contactEmail ?? "", 48, 60);
  doc
    .fillColor(accent)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text(opts.title, 48, 36, { align: "right" });
  if (opts.subtitle) {
    doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(opts.subtitle, 48, 58, { align: "right" });
  }
  doc.moveTo(48, 84).lineTo(doc.page.width - 48, 84).strokeColor(LINE).stroke();
  doc.moveDown(2);
  doc.y = 100;

  build(doc, accent);

  doc.end();
}

/** A simple label/value line. */
export function field(doc: Doc, label: string, value: string) {
  const y = doc.y;
  doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(label, 48, y, { width: 130 });
  doc.fillColor(INK).fontSize(11).font("Helvetica-Bold").text(value, 178, y);
  doc.moveDown(0.6);
}

/** A bordered table: header row + body rows. cols = widths summing to ~500. */
export function table(
  doc: Doc,
  headers: string[],
  rows: string[][],
  cols: number[],
  accent: string
) {
  const left = 48;
  const rowH = 22;
  let y = doc.y + 6;

  // header
  doc.rect(left, y, cols.reduce((a, c) => a + c, 0), rowH).fill("#f2f4f7");
  doc.fillColor(INK).fontSize(9).font("Helvetica-Bold");
  let x = left;
  headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), x + 8, y + 7, { width: cols[i] - 12 });
    x += cols[i];
  });
  y += rowH;

  // body
  doc.font("Helvetica").fontSize(10);
  for (const row of rows) {
    x = left;
    row.forEach((cell, i) => {
      doc.fillColor(INK).text(cell, x + 8, y + 6, { width: cols[i] - 12 });
      x += cols[i];
    });
    doc.moveTo(left, y + rowH).lineTo(left + cols.reduce((a, c) => a + c, 0), y + rowH).strokeColor(LINE).stroke();
    y += rowH;
  }
  doc.y = y + 6;
  void accent;
}

export const inr = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;
