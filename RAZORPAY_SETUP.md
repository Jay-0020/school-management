# Online Fee Payment — Razorpay Setup & Integration Guide

How to connect a school's Razorpay account so parents can pay fees online, and
where the feature lives in the codebase.

**Model:** each school uses **its own Razorpay account** (money settles directly
to that school's bank). The platform never holds funds. **Parents pay a small
convenience fee on top**, so the school receives the full fee.

> ⚠️ **Multi-tenant limitation (current):** the Razorpay keys
> (`RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET`) are read from **global
> environment variables**, not from the per-school tenant registry. So the
> per-school-account model above holds for a **single-school deploy**, but in
> multi-school mode all schools would share one Razorpay account. To make it
> truly per-school: carry these keys per tenant in `backend/tenants.json` and
> have `src/modules/fees/online.ts` read them from the resolved tenant instead
> of `env`. Do this before enabling online payments for multiple live schools.
> (See the same note in [GOING-LIVE.md](./GOING-LIVE.md).)

> **Test vs Live in one line:** *Test mode needs NO KYC/documents — use it to
> verify the integration today.* *Live mode (real money) requires account
> activation (KYC).*

---

## Part 1 — Create a Razorpay account

1. Go to **https://razorpay.com** → **Sign Up**.
2. Enter **email + phone**, set a password (or sign up with Google).
3. **Verify** the email link / phone OTP.
4. Answer the basic business questions (business name, type → "Education",
   what you're building). *No documents needed at this stage.*
5. You land in the **Razorpay Dashboard**.

At this point **Test Mode is fully usable** — you can get test API keys and
integrate immediately, without any KYC.

---

## Part 2 — Get API keys

### Test keys (instant, no KYC)
1. In the dashboard, switch the **Test / Live toggle** to **Test Mode**.
2. **Settings → API Keys** (or **Account & Settings → API Keys**; or open
   `https://dashboard.razorpay.com/app/keys`).
3. **Generate Test Key** → copy/download:
   - **Key ID** → `rzp_test_…`
   - **Key Secret** → shown **once** — copy it immediately.

### Live keys (after activation — see Part 4)
Same page in **Live Mode**: **Generate Live Key** → `rzp_live_…` + secret.

---

## Part 3 — Webhook (production reliability)

The webhook is Razorpay telling our server directly that a payment succeeded —
the safety net for when a parent's browser closes mid-payment.

> **Note:** new accounts often **gate webhooks behind activation**, even in test
> mode. The integration works **without** the webhook (the in-browser verify
> step settles the invoice); the webhook is the production backstop and is set up
> on each school's **activated** account.

To add it: **Settings → Webhooks → Add New Webhook**
- **URL:** `https://<your-domain>/api/fees/online/webhook`
- **Secret:** any strong random string (must match `RAZORPAY_WEBHOOK_SECRET`)
- **Active events:** `payment.captured` and `order.paid`

---

## Part 4 — KYC / Activation (only for accepting real money)

Required only to go **Live**. Steps in the dashboard's activation flow:

1. **Business details** — legal name, type (Proprietorship / Partnership / Pvt
   Ltd / Trust / Society / School), address.
2. **PAN** — of the business (and/or authorised signatory).
3. **Bank account** — where settlements land (account no. + IFSC; a cancelled
   cheque / bank statement may be requested).
4. **Business proof / category documents.** For **schools (Education category)**
   Razorpay asks for one of:
   - **Affiliation Certificate**, or
   - **Local Body Approval Certificate** (for schools up to 8th standard).
   Accepted formats: PDF / JPEG / PNG / JPG / HEIF, max 15 MB.
   *These belong to the school — in our model each school supplies its own.*

**Verification timeline (typical, varies):**
- Test mode: **instant** (no review).
- Live activation review: **usually ~2–4 working days** after all documents are
  submitted; can be same-day for simple cases or longer if documents need
  re-submission or extra category checks.
- After activation, **settlements** reach the school's bank on a **T+2 working
  days** cycle by default (configurable in Razorpay).

> Tip: you can build and integration-test in **Test Mode while activation is
> pending** — order creation + signature verify work regardless (see Part 6).

> **⚠️ Business category matters (learned in testing).** If an account is
> registered as **Education / School** and left **un-activated**, Razorpay
> **restricts its test checkout** — the hosted Checkout opens but **rejects every
> method** (cards show "International cards are not supported", netbanking fails,
> risk-detection JS returns 503). So:
> - For the **platform/developer's own** Razorpay account (used only to wire up
>   and demo the integration), register under your **real business** —
>   **IT / software, individual/proprietor — NOT "School"**. That category needs
>   only PAN + bank + business proof (no affiliation cert) and its **test
>   checkout processes normally** (domestic card / `success@razorpay`).
> - Each **real school** uses **its own** account and supplies **its own**
>   affiliation certificate. Never upload a school document that isn't yours.

---

## Part 5 — Where the keys go (enabling it per school)

Online pay **auto-enables** the moment `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
are present. Set these as **environment variables** on the school's instance.

**Local (`backend/.env`):**
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret      # optional until webhook is set
CONVENIENCE_FEE_PERCENT=2.36                      # parent-paid fee (2% + 18% GST)
```
Restart the backend after changing env.

**Render (deployed):** Service → **Environment** → add the same four vars →
Render restarts automatically. (Local `.env` does NOT apply to Render.)

---

## Part 6 — Test the flow (no real money)

1. Ensure test keys are set + backend restarted.
2. Log in as a **parent/student** → open an **unpaid invoice** → **Pay online**.
3. Pay with a Razorpay **test instrument** (needs a properly set-up account —
   see the business-category warning in Part 4):
   - **UPI:** `success@razorpay` (succeeds) / `failure@razorpay` (fails) — cleanest.
   - **Card (domestic):** `5104 0155 5555 5558` (Mastercard), any future expiry,
     any CVV; enter any OTP / choose **Success**. *(Avoid `4111 1111 1111 1111`
     — its BIN is treated as international and fails on accounts without
     international cards enabled.)*
4. The invoice should flip to **PAID** and a payment row appears
   (method `ONLINE`, reference = the Razorpay payment id).

> **Verifying the integration without the hosted checkout.** If your test
> account's checkout is restricted (Part 4), you can still prove the server path:
> create an order via `…/online-order`, then POST to `…/online-verify` with a
> signature = `HMAC_SHA256("<order_id>|<payment_id>", KEY_SECRET)`. A valid
> signature settles the invoice to PAID (crediting only the fee, not the
> surcharge); a tampered one is rejected. This confirms order → verify → settle
> independently of Razorpay's UI.

---

## Part 7 — Where we integrate it (codebase map)

| Piece | Location |
|---|---|
| **Config / enable flag** | `backend/src/config/env.ts` — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CONVENIENCE_FEE_PERCENT`. Online pay enabled when key id + secret are set. |
| **Payment logic** | `backend/src/modules/fees/online.ts` — Razorpay client, order creation, signature verify, **idempotent settlement**, webhook handler, shared `recomputeInvoice`. |
| **API endpoints** | `backend/src/modules/fees/fees.routes.ts` — `GET /api/fees/online/config`, `POST /api/fees/invoices/:id/online-order`, `POST /api/fees/invoices/:id/online-verify`. |
| **Webhook route** | `backend/src/app.ts` — `POST /api/fees/online/webhook` (registered **before** the JSON parser so it receives the raw body for HMAC verification; no auth). |
| **CSP allowlist** | `backend/src/app.ts` — Helmet's Content-Security-Policy must allow Razorpay: `script-src` → `checkout.razorpay.com`, `frame-src`/`connect-src` → `*.razorpay.com`. Without it the browser blocks Checkout and you get "Could not start payment". |
| **Data model** | `backend/prisma/schema.prisma` — `PaymentOrder` model + `PaymentOrderStatus` enum (links a Razorpay order to an invoice; gives idempotent settlement). Migration `…_add_payment_order`. Successful payments are recorded as a `Payment` with method `ONLINE`. |
| **Frontend** | `frontend/src/pages/FeesPage.tsx` — the **"Pay online"** button on a parent/student's unpaid invoice (in `InvoiceModal`), the fee breakdown, on-demand Razorpay Checkout, and the verify call. |

### How a payment flows
1. Parent taps **Pay online** → `POST /online-order` → server computes
   `outstanding + convenience fee`, creates a Razorpay **order**, stores a
   `PaymentOrder`, returns the order + key id.
2. Frontend opens **Razorpay Checkout** (card details never touch our server).
3. On success → `POST /online-verify` → server verifies the
   **HMAC signature**, records the `Payment` (only the fee portion), recomputes
   the invoice → **PAID**.
4. **Webhook** (`payment.captured` / `order.paid`) independently confirms the
   same — **idempotent**, so verify + webhook never double-credit.

### Money math (parent pays the fee)
- Parent is charged **`outstanding + round(outstanding × CONVENIENCE_FEE_PERCENT%)`**.
- Razorpay takes its cut from the total; the **school nets the full `outstanding`**.
- Only `outstanding` is credited to the invoice; the surcharge just covers the
  gateway fee.

---

## Part 8 — Go-live checklist (per school)

- [ ] School completes Razorpay **activation/KYC** (their documents).
- [ ] Swap **test keys → live keys** (`rzp_live_…`) in the instance env.
- [ ] Add the **webhook** on the live account → `…/api/fees/online/webhook`
      (events `payment.captured`, `order.paid`) with the secret matching
      `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Set `CONVENIENCE_FEE_PERCENT` (default 2.36) to whatever the school wants
      parents to pay.
- [ ] Restart / redeploy → do one small real payment to confirm settlement.

---

## Security notes
- **No card data** touches our server — Razorpay Checkout (PCI-DSS) handles it.
- Every payment is confirmed by **HMAC-SHA256 signature** (and the webhook is
  HMAC-verified with the webhook secret).
- The **amount is set server-side** from the invoice — the client can't tamper it.
- Settlement is **idempotent** via `PaymentOrder`, so retries/duplicate
  notifications can't double-credit an invoice.
- Secrets (`*_SECRET`) live only in server env, never in the frontend.
