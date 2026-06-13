import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string(),

  JWT_SECRET: z.string().min(8, "JWT_SECRET must be set"),
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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
