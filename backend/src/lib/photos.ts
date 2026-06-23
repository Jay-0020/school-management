import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, createReadStream, unlink } from "node:fs";
import { basename, extname, join } from "node:path";
import type { RequestHandler, Response } from "express";
import multer from "multer";
import { ApiError } from "./http";
import { currentTenant } from "./tenant-context";

// Profile photos for students & staff. Files live on disk; the DB stores only
// the filename (`photoFile`). Storage is namespaced PER TENANT and served only
// through tenant-scoped routes, so one school can never reach another's photos.

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Per-tenant photo directory: uploads/<tenant-db>/photos (created on demand). */
function photoDir(): string {
  const db = currentTenant()?.db || "default";
  const safeDb = db.replace(/[^a-z0-9_]/gi, "_"); // never let the tenant key escape the path
  const dir = join(process.cwd(), "uploads", safeDb, "photos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, photoDir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname) || ".jpg"}`),
  }),
  // Hard cap — the client resizes to ~400px before upload, so real photos are
  // tens of KB; this just bounds abuse.
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error("Only PNG, JPEG or WebP images are allowed")),
});

/** Multer middleware for a single `photo` field, with clean 400s on bad input. */
export const uploadPhoto: RequestHandler = (req, res, next) =>
  upload.single("photo")(req, res, (err: unknown) =>
    err ? next(ApiError.badRequest((err as Error).message || "Upload failed")) : next()
  );

/** Stream a stored photo from the CURRENT tenant's dir (404 if missing). */
export function streamPhoto(res: Response, fileName: string | null | undefined): void {
  if (!fileName) throw ApiError.notFound("No photo");
  const safe = basename(fileName); // guard against path traversal
  const path = join(photoDir(), safe);
  if (!existsSync(path)) throw ApiError.notFound("Photo not found");
  res.setHeader("Content-Type", CONTENT_TYPE[extname(safe).toLowerCase()] || "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=300");
  createReadStream(path).pipe(res);
}

/** Best-effort delete of a stored photo file (e.g. when replacing/removing). */
export function deletePhotoFile(fileName: string | null | undefined): void {
  if (!fileName) return;
  unlink(join(photoDir(), basename(fileName)), () => {});
}
