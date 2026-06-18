// One-off cleanup: remove invoices created during testing (title contains
// "Agent Test"). Their payments, items, and payment-orders cascade-delete.
// Run against the target DB by passing DATABASE_URL:
//   cd backend && DATABASE_URL='<external db url>' node cleanup-test-invoices.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const where = { title: { contains: "Agent Test" } };

const found = await prisma.invoice.findMany({
  where,
  select: { id: true, title: true, status: true },
});

console.log(`Found ${found.length} invoice(s) with "Agent Test" in the title.`);
for (const i of found.slice(0, 10)) console.log(`  - ${i.title} [${i.status}]`);
if (found.length > 10) console.log(`  …and ${found.length - 10} more`);

if (found.length > 0) {
  const res = await prisma.invoice.deleteMany({ where });
  console.log(`Deleted ${res.count} invoice(s) (payments / items / payment-orders cascaded).`);
} else {
  console.log("Nothing to delete.");
}

await prisma.$disconnect();
