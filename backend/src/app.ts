import { existsSync } from "node:fs";
import { join } from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { normalizeHost, resolveTenant } from "./config/tenants";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { resolveTenantMiddleware } from "./middleware/tenant";
import { assignmentsRouter } from "./modules/assignments/assignments.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { attendanceRouter } from "./modules/attendance/attendance.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { examsRouter } from "./modules/exams/exams.routes";
import { expensesRouter } from "./modules/expenses/expenses.routes";
import { feedbackRouter } from "./modules/feedback/feedback.routes";
import { leaveRouter } from "./modules/leave/leave.routes";
import { profileRouter } from "./modules/profile/profile.routes";
import { ratingsRouter } from "./modules/ratings/ratings.routes";
import { classesRouter } from "./modules/classes/classes.routes";
import { complaintsRouter } from "./modules/complaints/complaints.routes";
import { feesRouter } from "./modules/fees/fees.routes";
import { razorpayWebhookHandler } from "./modules/fees/online";
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
  app.set("trust proxy", 1); // behind Render's proxy — real client IP for logs/rate-limit

  // CSP: allow images over https (OpenStreetMap tiles + external school logos)
  // and allowlist Razorpay Checkout (external script + its iframe + API calls)
  // for online fee payment; everything else keeps Helmet's secure defaults.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "https:"],
          "script-src": ["'self'", "https://checkout.razorpay.com"],
          "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://*.razorpay.com"],
          "connect-src": ["'self'", "https://*.razorpay.com", "https://lumberjack.razorpay.com"],
        },
      },
    })
  );
  // Multi-tenant: accept any registered school's own origin (plus the dev SPA
  // origin). In production each school is served same-origin so this is rarely
  // hit; it matters for local dev where the Vite SPA runs on a separate port.
  app.use(
    cors({
      credentials: true,
      origin(origin, cb) {
        if (!origin) return cb(null, true); // same-origin, curl, server-to-server
        if (origin === env.CORS_ORIGIN) return cb(null, true);
        try {
          if (resolveTenant(normalizeHost(new URL(origin).host))) return cb(null, true);
        } catch {
          /* malformed origin → reject below */
        }
        return cb(null, false);
      },
    })
  );

  // Resolve the school from the request hostname and run the rest of the request
  // inside its tenant context (DB client + secret). Must come before any route
  // that touches the DB — including the Razorpay webhook below.
  app.use(resolveTenantMiddleware);

  // Razorpay webhook needs the RAW body for HMAC verification, so it must be
  // registered before the JSON parser. No auth — Razorpay calls it directly.
  app.post(
    "/api/fees/online/webhook",
    express.raw({ type: "*/*" }),
    razorpayWebhookHandler
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  // Basic abuse protection across auth endpoints.
  app.use(
    "/api/auth",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true })
  );
  // Strict brute-force guard on login: only FAILED attempts count, so a normal
  // sign-in is unaffected but password-guessing is throttled hard.
  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      message: { error: "Too many login attempts — please try again in a few minutes." },
    })
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
  app.use("/api/audit", auditRouter);
  app.use("/api/ratings", ratingsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/complaints", complaintsRouter);
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
