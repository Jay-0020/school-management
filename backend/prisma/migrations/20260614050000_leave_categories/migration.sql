-- CreateEnum
CREATE TYPE "LeaveCategory" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'UNPAID');

-- AlterTable: User quota columns
ALTER TABLE "User" DROP COLUMN "leaveQuota",
  ADD COLUMN "casualQuota" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "sickQuota" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "earnedQuota" INTEGER NOT NULL DEFAULT 15;

-- AlterTable: LeaveRequest category
ALTER TABLE "LeaveRequest" ADD COLUMN "category" "LeaveCategory" NOT NULL DEFAULT 'CASUAL';
