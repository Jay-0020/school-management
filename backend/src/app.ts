import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { attendanceRouter } from "./modules/attendance/attendance.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { classesRouter } from "./modules/classes/classes.routes";
import { noticesRouter } from "./modules/notices/notices.routes";
import { schoolRouter } from "./modules/school/school.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { teachersRouter } from "./modules/teachers/teachers.routes";

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

  app.use("/api/auth", authRouter);
  app.use("/api/school", schoolRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/notices", noticesRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/teachers", teachersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
