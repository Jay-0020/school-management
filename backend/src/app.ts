import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { assignmentsRouter } from "./modules/assignments/assignments.routes";
import { attendanceRouter } from "./modules/attendance/attendance.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { examsRouter } from "./modules/exams/exams.routes";
import { expensesRouter } from "./modules/expenses/expenses.routes";
import { leaveRouter } from "./modules/leave/leave.routes";
import { profileRouter } from "./modules/profile/profile.routes";
import { ratingsRouter } from "./modules/ratings/ratings.routes";
import { classesRouter } from "./modules/classes/classes.routes";
import { feesRouter } from "./modules/fees/fees.routes";
import { noticesRouter } from "./modules/notices/notices.routes";
import { notesRouter } from "./modules/notes/notes.routes";
import { parentRouter } from "./modules/parent/parent.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { payrollRouter } from "./modules/payroll/payroll.routes";
import { schoolRouter } from "./modules/school/school.routes";
import { settlementsRouter } from "./modules/settlements/settlements.routes";
import { staffAttendanceRouter } from "./modules/staff-attendance/staff-attendance.routes";
import { schoolworkRouter } from "./modules/schoolwork/schoolwork.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { teachersRouter } from "./modules/teachers/teachers.routes";
import { usersRouter } from "./modules/users/users.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  // Basic abuse protection on auth endpoints
  app.use(
    "/api/auth",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true })
  );

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/dashboard", dashboardRouter);

  app.use("/api/auth", authRouter);
  app.use("/api/school", schoolRouter);
  app.use("/api/schoolwork", schoolworkRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/staff-attendance", staffAttendanceRouter);
  app.use("/api/assignments", assignmentsRouter);
  app.use("/api/ratings", ratingsRouter);
  app.use("/api/exams", examsRouter);
  app.use("/api/fees", feesRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/leave", leaveRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/notices", noticesRouter);
  app.use("/api/notes", notesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/parent", parentRouter);
  app.use("/api/payroll", payrollRouter);
  app.use("/api/settlements", settlementsRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/teachers", teachersRouter);
  app.use("/api/users", usersRouter);

  // Unknown API routes → JSON 404.
  app.use("/api", notFoundHandler);

  // In a packaged deploy, serve the built SPA from the same server.
  const clientDir = process.env.CLIENT_DIR || join(__dirname, "..", "..", "frontend", "dist");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));
  }

  app.use(errorHandler);

  return app;
}
