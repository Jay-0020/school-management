-- CreateEnum
CREATE TYPE "StudentFeedbackType" AS ENUM ('FEEDBACK', 'COMMENDATION');

-- CreateTable
CREATE TABLE "StudentFeedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" "StudentFeedbackType" NOT NULL DEFAULT 'FEEDBACK',
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFeedback_studentId_idx" ON "StudentFeedback"("studentId");

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
