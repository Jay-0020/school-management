import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/http";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

// Express needs the 4-arg signature to recognise this as an error handler.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: err.flatten().fieldErrors });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
