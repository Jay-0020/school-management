// Generates a client-facing "Online Fee Payment — Options & Costs" PDF.
// Plain-language doc to help a (non-technical) school decide: who pays the
// processing fee (parent vs school) and which payment company to use.
// Run from backend/:  PAY_OUT=/path/out.pdf node make-payment-options.mjs
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OUT = process.env.PAY_OUT || join(homedir(), "Desktop", "Online-Fee-Payment-Options.pdf");

const INDIGO = "#4f46e5";
const DARK = "#1e1b4b";
const GREY = "#475569";
const LIGHT = "#eef2ff";
const ZEBRA = "#f1f5f9";

const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
doc.pipe(createWriteStream(OUT));

const W = doc.page.width - 100;
const L = 50;
const BOTTOM = doc.page.height - 60;

function ensure(space) {
  if (doc.y + space > BOTTOM) doc.addPage();
}
function band(title, subtitle) {
  doc.rect(0, 0, doc.page.width, 100).fill(INDIGO);
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text(title, L, 30);
  if (subtitle) doc.font("Helvetica").fontSize(12).fill("#e0e7ff").text(subtitle, L, 64);
  doc.fill("#000000");
  doc.y = 120;
}
function h2(t) {
  ensure(60);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(15).fill(DARK).text(t, L);
  const y = doc.y + 2;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).stroke(INDIGO);
  doc.moveDown(0.5).fill("#000000");
}
function para(t, opts = {}) {
  ensure(40);
  doc.font(opts.italic ? "Helvetica-Oblique" : "Helvetica").fontSize(opts.size || 10.5)
    .fill(opts.color || GREY).text(t, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.35);
}
function bullets(items) {
  doc.fontSize(10.5);
  for (const it of items) {
    ensure(26);
    const [head, body] = it.split("::");
    doc.font("Helvetica-Bold").fill("#334155").text("•  " + head.trim() + (body ? " " : ""), L, doc.y, { continued: !!body, indent: 4 });
    if (body) doc.font("Helvetica").fill(GREY).text(body.trim(), { lineGap: 1 });
    else doc.text("");
  }
  doc.moveDown(0.3);
}
function optionBox(title, body) {
  const padding = 10;
  const tw = W - padding * 2;
  doc.font("Helvetica-Bold").fontSize(11);
  const th = doc.heightOfString(title, { width: tw });
  doc.font("Helvetica").fontSize(10);
  const bh = doc.heightOfString(body, { width: tw, lineGap: 2 });
  const boxH = th + bh + padding * 2 + 4;
  ensure(boxH + 10);
  const y = doc.y;
  doc.rect(L, y, W, boxH).fill(LIGHT);
  doc.fill(DARK).font("Helvetica-Bold").fontSize(11).text(title, L + padding, y + padding, { width: tw });
  doc.fill(GREY).font("Helvetica").fontSize(10).text(body, L + padding, doc.y + 2, { width: tw, lineGap: 2 });
  doc.y = y + boxH + 8;
  doc.fill("#000000");
}
function table(headers, rows, widths) {
  const pad = 6;
  ensure(50);
  let y = doc.y;
  let headerH = 0;
  headers.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(9.5);
    headerH = Math.max(headerH, doc.heightOfString(String(h), { width: widths[i] - pad * 2, lineGap: 1 }));
  });
  headerH += pad * 2;
  doc.rect(L, y, W, headerH).fill(DARK);
  let x = L;
  doc.font("Helvetica-Bold").fontSize(9.5).fill("#ffffff");
  headers.forEach((h, i) => { doc.text(String(h), x + pad, y + pad, { width: widths[i] - pad * 2, lineGap: 1 }); x += widths[i]; });
  y += headerH;
  rows.forEach((row, ri) => {
    let h = 0;
    row.forEach((cell, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
      h = Math.max(h, doc.heightOfString(String(cell), { width: widths[i] - pad * 2, lineGap: 1 }));
    });
    h += pad * 2;
    if (y + h > BOTTOM) { doc.addPage(); y = doc.y; }
    if (ri % 2 === 0) doc.rect(L, y, W, h).fill(ZEBRA);
    let cx = L;
    row.forEach((cell, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fill(i === 0 ? DARK : GREY)
        .text(String(cell), cx + pad, y + pad, { width: widths[i] - pad * 2, lineGap: 1 });
      cx += widths[i];
    });
    y += h;
  });
  doc.y = y + 8;
  doc.fill("#000000");
}

// ── Cover ────────────────────────────────────────────────────────────────────
band("Online Fee Payment", "Options & costs for collecting school fees online");

para("I can set up online fee payment so parents pay school fees — by UPI, debit/credit card or net banking — directly from the app. The moment a parent pays, their fee bill is marked paid automatically and a receipt is generated. The money goes straight into the school's own bank account; it never passes through me or the app.");
para("Every online payment carries a small processing fee charged by the company that handles the payment. This short document explains your options in plain terms, so you can tell me how you'd like it set up. There are no wrong answers — it's about your preference.");

// ── The decision ─────────────────────────────────────────────────────────────
h2("The main decision: who pays the small processing fee?");
para("Online payments cost roughly 2% of the amount, charged by the payment company. Someone has to cover that. Two simple choices:");
optionBox("Option A — Pass the fee to the parent  (most schools choose this)",
  "A small 'convenience fee' is added when the parent pays. The parent pays the fee plus the small charge, and the school receives 100% of the fee. Example: on a Rs 10,000 fee, the parent pays about Rs 200 extra; the school still gets the full Rs 10,000.");
optionBox("Option B — The school covers the fee",
  "The parent pays only the fee amount. The school receives the fee minus the small charge. Example: on a Rs 10,000 fee, the parent pays Rs 10,000 and the school receives about Rs 9,800.");

// ── How it works ─────────────────────────────────────────────────────────────
h2("How it works for a parent");
bullets([
  "Opens their fee bill in the app",
  "Taps \"Pay now\"",
  "Pays by UPI, card or net banking",
  "The bill is marked paid instantly and a receipt is created",
  "The money lands directly in the school's bank account",
]);

// ── Gateways ─────────────────────────────────────────────────────────────────
h2("The payment companies you can use");
para("A 'payment company' (gateway) is simply the trusted service that securely processes the payment. All of the below are safe, widely used across India, and card details are never stored by the app. Their charges:");
table(
  ["Option", "What it is", "Charge per payment", "Setup fee"],
  [
    ["Razorpay", "India's most popular option; easiest to set up yourself.", "About 2% + GST, all methods", "None"],
    ["Cashfree", "Equally reliable; currently the cheapest.", "1.95% standard, or 1.6% for new sign-ups (offer to mid-2026, 1 yr)", "None"],
    ["PayU", "Long-established and widely used.", "About 2% + GST, all methods", "None"],
    ["Juspay", "Enterprise-grade, strong on UPI. Price is negotiated, not fixed.", "Roughly 1.5%-2.5%, by custom quote", "None"],
  ],
  [70, 215, 140, 70]
);
para("About UPI: UPI itself is free by government rule, but the payment company charges a small service fee for automatically matching each payment to the right fee bill and giving you receipts, dashboards and reconciliation. 'GST' is the standard 18% government tax on the fee itself — so a 2% fee works out to about 2.36% after GST.", { italic: true, size: 9.5 });

// ── Cost example ─────────────────────────────────────────────────────────────
h2("A quick cost example (at about 2%)");
table(
  ["Fee amount", "Processing fee (~2%)", "Parent pays (Option A)", "School receives (Option B)"],
  [
    ["Rs 5,000", "~Rs 100", "Rs 5,100", "Rs 4,900"],
    ["Rs 10,000", "~Rs 200", "Rs 10,200", "Rs 9,800"],
    ["Rs 25,000", "~Rs 500", "Rs 25,500", "Rs 24,500"],
  ],
  [110, 125, 135, 125]
);

// ── Good to know ─────────────────────────────────────────────────────────────
h2("Good to know");
para("The school will need its own free account with the chosen payment company so money settles directly to your bank — I'll guide you through that simple sign-up.");

// ── Footer ───────────────────────────────────────────────────────────────────
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(8).fill("#94a3b8")
    .text(`School Management Portal — Online Fee Payment Options        Page ${i + 1} of ${range.count}`,
      L, doc.page.height - 35, { width: W, align: "center", lineBreak: false });
  doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log("PDF written to:", OUT);
