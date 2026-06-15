-- Onboarding/retention: track when a student joined and when they left.
ALTER TABLE "Student" ADD COLUMN "admissionDate" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "leftAt" TIMESTAMP(3);

-- Backfill admission date from the record-created date for existing students.
UPDATE "Student" SET "admissionDate" = "createdAt" WHERE "admissionDate" IS NULL;
