-- Reduce leave categories to CASUAL and SICK only (drop EARNED + UNPAID).
-- Existing rows are remapped first so the enum narrowing can't fail:
--   EARNED -> CASUAL, UNPAID -> SICK.

UPDATE "LeaveRequest" SET "category" = 'CASUAL' WHERE "category" = 'EARNED';
UPDATE "LeaveRequest" SET "category" = 'SICK'   WHERE "category" = 'UNPAID';

-- Recreate the enum without the removed values (Postgres can't drop values in place).
ALTER TYPE "LeaveCategory" RENAME TO "LeaveCategory_old";
CREATE TYPE "LeaveCategory" AS ENUM ('CASUAL', 'SICK');
ALTER TABLE "LeaveRequest" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "LeaveRequest" ALTER COLUMN "category" TYPE "LeaveCategory" USING ("category"::text::"LeaveCategory");
ALTER TABLE "LeaveRequest" ALTER COLUMN "category" SET DEFAULT 'CASUAL';
DROP TYPE "LeaveCategory_old";

-- Drop the now-unused earned-leave quota.
ALTER TABLE "User" DROP COLUMN "earnedQuota";
