-- DropIndex
DROP INDEX "Holiday_date_idx";

-- CreateIndex
CREATE INDEX "LeaveRequest_applicantId_status_fromDate_idx" ON "LeaveRequest"("applicantId", "status", "fromDate");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "Student_admissionDate_idx" ON "Student"("admissionDate");

-- CreateIndex
CREATE INDEX "Teacher_isActive_idx" ON "Teacher"("isActive");

-- CreateIndex
CREATE INDEX "Teacher_staffType_idx" ON "Teacher"("staffType");
