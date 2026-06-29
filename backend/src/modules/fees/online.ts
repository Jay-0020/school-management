// Online fee payment via Razorpay. Secure flow: server creates the order →
// parent pays in Razorpay Checkout → server verifies the signature → a webhook
// confirms it as the source of truth. Card details never touch this server.
import crypto from "node:crypto";
import type { Request, Response } from "express";
import Razorpay from "razorpay";
import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { currentTenant } from "../../lib/tenant-context";

// Razorpay credentials are PER SCHOOL: each tenant carries its own keys in the
// registry, so a parent's payment settles into THAT school's account rather than
// one shared account. Falls back to global env for the single-tenant demo/fallback.
function rzpConfig() {
  const t = currentTenant();
  return {
    keyId: t?.razorpayKeyId ?? env.RAZORPAY_KEY_ID,
    keySecret: t?.razorpayKeySecret ?? env.RAZORPAY_KEY_SECRET,
    webhookSecret: t?.razorpayWebhookSecret ?? env.RAZORPAY_WEBHOOK_SECRET,
    feePercent: t?.razorpayConveniencePercent ?? env.CONVENIENCE_FEE_PERCENT,
  };
}

export function onlineEnabled(): boolean {
  const c = rzpConfig();
  return !!(c.keyId && c.keySecret);
}

/** Public-safe config for the frontend (no secrets). */
export function onlineConfig() {
  const c = rzpConfig();
  return {
    enabled: !!(c.keyId && c.keySecret),
    keyId: c.keyId ?? null,
    feePercent: c.feePercent,
  };
}

// One Razorpay client per key id (each school's own account).
const clients = new Map<string, Razorpay>();
function client(): Razorpay {
  const c = rzpConfig();
  if (!c.keyId || !c.keySecret) throw new OnlinePayError("ONLINE_DISABLED");
  let inst = clients.get(c.keyId);
  if (!inst) {
    inst = new Razorpay({ key_id: c.keyId, key_secret: c.keySecret });
    clients.set(c.keyId, inst);
  }
  return inst;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Recompute an invoice's paid total and status from its payments. */
export async function recomputeInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return;
  const amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  let status: InvoiceStatus = invoice.status;
  if (invoice.status !== "CANCELLED") {
    if (amountPaid <= 0) status = "PENDING";
    else if (amountPaid >= invoice.total) status = "PAID";
    else status = "PARTIAL";
  }
  await prisma.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status } });
}

export class OnlinePayError extends Error {}

/** Create a Razorpay order for an invoice's outstanding balance (+ convenience
 *  fee paid by the parent). Persists a PaymentOrder for idempotent settlement. */
export async function createInvoiceOrder(
  invoiceId: string,
  prefill: { name?: string; email?: string; contact?: string }
) {
  if (!onlineEnabled()) throw new OnlinePayError("ONLINE_DISABLED");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new OnlinePayError("NOT_FOUND");
  if (invoice.status === "CANCELLED") throw new OnlinePayError("CANCELLED");

  const outstanding = invoice.total - invoice.amountPaid; // whole INR
  if (outstanding <= 0) throw new OnlinePayError("NOTHING_DUE");

  const cfg = rzpConfig();
  const surcharge = Math.round((outstanding * cfg.feePercent) / 100);
  const gross = outstanding + surcharge;

  const order = await client().orders.create({
    amount: gross * 100, // paise
    currency: "INR",
    notes: { invoiceId, feeAmount: String(outstanding) },
  });

  await prisma.paymentOrder.create({
    data: {
      id: order.id,
      invoiceId,
      feeAmount: outstanding,
      surcharge,
      grossAmount: gross,
      status: "CREATED",
    },
  });

  return {
    orderId: order.id,
    amount: gross * 100,
    currency: "INR",
    keyId: cfg.keyId,
    invoiceTitle: invoice.title,
    outstanding,
    surcharge,
    gross,
    prefill,
  };
}

/** Checkout handshake signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", rzpConfig().keySecret!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

/** Idempotently credit an invoice from a paid order. Safe to call from both the
 *  verify endpoint and the webhook — only the first call records the payment. */
export async function settleOrder(orderId: string, paymentId: string): Promise<string | null> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) return null;
  if (order.status === "PAID") return order.invoiceId;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.paymentOrder.findUnique({ where: { id: orderId } });
    if (!fresh || fresh.status === "PAID") return; // raced — already settled
    await tx.payment.create({
      data: {
        invoiceId: fresh.invoiceId,
        amount: fresh.feeAmount,
        method: "ONLINE",
        reference: `Razorpay ${paymentId}`,
      },
    });
    await tx.paymentOrder.update({
      where: { id: orderId },
      data: { status: "PAID", razorpayPaymentId: paymentId },
    });
  });
  await recomputeInvoice(order.invoiceId);
  return order.invoiceId;
}

/** Razorpay webhook (raw body, HMAC-verified) — the authoritative confirmation. */
export async function razorpayWebhookHandler(req: Request, res: Response) {
  const secret = rzpConfig().webhookSecret;
  if (!secret) return res.status(503).json({ error: "webhook not configured" });

  const signature = req.header("x-razorpay-signature") ?? "";
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!safeEqual(expected, signature)) return res.status(400).json({ error: "bad signature" });

  let event: any;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "bad payload" });
  }

  try {
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const orderId = payment?.order_id ?? orderEntity?.id;
      const paymentId = payment?.id ?? "webhook";
      if (orderId) await settleOrder(orderId, paymentId);
    }
    return res.json({ ok: true });
  } catch {
    // Non-2xx makes Razorpay retry, which is what we want on a transient failure.
    return res.status(500).json({ error: "settle failed" });
  }
}
