-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('GENERATED', 'PAID');

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "basic" INTEGER NOT NULL,
    "hra" INTEGER NOT NULL DEFAULT 0,
    "da" INTEGER NOT NULL DEFAULT 0,
    "conveyance" INTEGER NOT NULL DEFAULT 0,
    "specialAllowance" INTEGER NOT NULL DEFAULT 0,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "professionalTax" INTEGER NOT NULL DEFAULT 0,
    "tdsMonthly" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "basic" INTEGER NOT NULL,
    "hra" INTEGER NOT NULL,
    "da" INTEGER NOT NULL,
    "conveyance" INTEGER NOT NULL,
    "specialAllowance" INTEGER NOT NULL,
    "gross" INTEGER NOT NULL,
    "pf" INTEGER NOT NULL,
    "esi" INTEGER NOT NULL,
    "professionalTax" INTEGER NOT NULL,
    "tds" INTEGER NOT NULL,
    "totalDeductions" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'GENERATED',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_teacherId_key" ON "SalaryStructure"("teacherId");

-- CreateIndex
CREATE INDEX "Payslip_month_idx" ON "Payslip"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_teacherId_month_key" ON "Payslip"("teacherId", "month");

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
