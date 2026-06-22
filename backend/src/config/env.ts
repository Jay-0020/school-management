import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Per-tenant now: each school's DATABASE_URL and JWT_SECRET come from the
  // tenant registry (tenants.json), resolved per request — not from process env.
  // Kept optional so provisioning/seed subprocesses (which set them) still parse.
  DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // White-label seed values for this deployment
  SCHOOL_NAME: z.string().default("Demo Public School"),
  SCHOOL_SHORT_NAME: z.string().optional(),
  SCHOOL_PRIMARY_COLOR: z.string().default("#1d4ed8"),
  SCHOOL_LOGO_URL: z.string().optional(),
  SCHOOL_CONTACT_EMAIL: z.string().optional(),
  SCHOOL_CONTACT_PHONE: z.string().optional(),
  SCHOOL_CURRENCY: z.string().default("INR"),
  SCHOOL_TIMEZONE: z.string().default("Asia/Kolkata"),

  SEED_ADMIN_EMAIL: z.string().default("admin@demoschool.in"),
  SEED_ADMIN_PASSWORD: z.string().default("ChangeMe!123"),

  // Online fee payment (Razorpay). Online pay auto-enables when key id + secret
  // are set. Each school uses its own Razorpay account (per-instance).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Convenience fee the parent pays on top, so the school nets the full fee.
  // 2.36% ≈ Razorpay's 2% + 18% GST.
  CONVENIENCE_FEE_PERCENT: z.coerce.number().min(0).max(15).default(2.36),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
