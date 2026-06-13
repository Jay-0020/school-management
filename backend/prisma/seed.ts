import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

async function main() {
  // 1. White-label settings for this deployment (single row, id=1)
  await prisma.schoolSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: env.SCHOOL_NAME,
      shortName: env.SCHOOL_SHORT_NAME,
      primaryColor: env.SCHOOL_PRIMARY_COLOR,
      logoUrl: env.SCHOOL_LOGO_URL || null,
      contactEmail: env.SCHOOL_CONTACT_EMAIL || null,
      contactPhone: env.SCHOOL_CONTACT_PHONE || null,
      currency: env.SCHOOL_CURRENCY,
      timezone: env.SCHOOL_TIMEZONE,
    },
  });
  console.log(`✓ School settings ready: ${env.SCHOOL_NAME}`);

  // 2. Seed admin account (forced to change password on first login)
  const existing = await prisma.user.findUnique({
    where: { email: env.SEED_ADMIN_EMAIL },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: env.SEED_ADMIN_EMAIL,
        passwordHash: await argon2.hash(env.SEED_ADMIN_PASSWORD),
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
    console.log(`✓ Admin created: ${env.SEED_ADMIN_EMAIL}`);
  } else {
    console.log(`• Admin already exists: ${env.SEED_ADMIN_EMAIL}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
