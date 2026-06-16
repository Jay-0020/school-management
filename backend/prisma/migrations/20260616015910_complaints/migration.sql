-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "aboutStaffId" TEXT NOT NULL,
    "filedById" TEXT,
    "filedByLabel" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_aboutStaffId_idx" ON "Complaint"("aboutStaffId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_aboutStaffId_fkey" FOREIGN KEY ("aboutStaffId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
