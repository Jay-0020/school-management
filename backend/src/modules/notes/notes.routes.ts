import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, createReadStream, unlink } from "node:fs";
import { basename, extname, join } from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { currentTenant } from "../../lib/tenant-context";

export const notesRouter = Router();

/** Per-tenant notes directory: uploads/<tenant-db>/notes (created on demand).
 *  Namespaced like photos.ts so one school's note row can never point at — or
 *  delete — another school's file in a shared directory. */
function notesDir(): string {
  const db = currentTenant()?.db || "default";
  const safeDb = db.replace(/[^a-z0-9_]/gi, "_"); // never let the tenant key escape the path
  const dir = join(process.cwd(), "uploads", safeDb, "notes");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, notesDir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error("Unsupported file type")),
});

// Run multer and convert its errors (bad type, too large) into clean 400s.
const uploadFile: import("express").RequestHandler = (req, res, next) =>
  upload.single("file")(req, res, (err: unknown) =>
    err ? next(ApiError.badRequest((err as Error).message || "Upload failed")) : next()
  );

notesRouter.use(authenticate);

const include = {
  subject: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, class: { select: { name: true } } } },
  uploadedBy: { select: { id: true, email: true, role: true } },
} satisfies Prisma.NoteInclude;

const isStaff = (r: string) => ["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"].includes(r);

// Notes may only be UPLOADED by academic staff (client requirement). Students &
// parents are read-only — which also keeps upload/storage load down.
const UPLOADERS = ["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"] as const;

// File-type filter groups → the mime types they cover.
const TYPE_MIMES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  image: ["image/png", "image/jpeg", "image/webp"],
  doc: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

// ── Upload ──────────────────────────────────────────────────────────────────
notesRouter.post(
  "/",
  requireRole(...UPLOADERS), // students/parents are rejected BEFORE the file is processed
  uploadFile,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("A file is required");
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().nullish(),
      subjectId: z.string().nullish(),
      sectionId: z.string().nullish(), // empty = school-wide
    });
    const data = schema.parse(req.body);

    // Only staff upload now, so notes are published immediately (no moderation).
    const note = await prisma.note.create({
      data: {
        title: data.title,
        description: data.description || null,
        subjectId: data.subjectId || null,
        sectionId: data.sectionId || null,
        uploadedById: req.user!.sub,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: "APPROVED",
      },
      include,
    });
    res.status(201).json(note);
  })
);

// ── List (role-scoped) ────────────────────────────────────────────────────
notesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);

    // Filters applied for every role (server-side so big lists stay cheap).
    const filters: Prisma.NoteWhereInput[] = [];
    if (req.query.q) filters.push({ title: { contains: String(req.query.q), mode: "insensitive" } });
    if (req.query.subjectId) filters.push({ subjectId: String(req.query.subjectId) });
    if (req.query.uploadedById) filters.push({ uploadedById: String(req.query.uploadedById) });
    if (req.query.sectionId) filters.push({ sectionId: String(req.query.sectionId) });
    const type = req.query.type ? String(req.query.type) : undefined;
    if (type && TYPE_MIMES[type]) filters.push({ mimeType: { in: TYPE_MIMES[type] } });

    // Visibility base: staff see all; students/parents see approved school-wide /
    // own-section notes plus their own uploads.
    let base: Prisma.NoteWhereInput;
    if (isStaff(role)) {
      base = {};
      if (req.query.status) base.status = req.query.status as Prisma.NoteWhereInput["status"];
    } else {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      const visible: Prisma.NoteWhereInput[] = [
        { status: "APPROVED", sectionId: null },
        { uploadedById: sub },
      ];
      if (student?.sectionId) visible.push({ status: "APPROVED", sectionId: student.sectionId });
      base = { OR: visible };
    }

    const where: Prisma.NoteWhereInput = filters.length ? { AND: [base, ...filters] } : base;

    const [items, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
      prisma.note.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
  })
);

// ── Download ────────────────────────────────────────────────────────────────
notesRouter.get(
  "/:id/download",
  asyncHandler(async (req, res) => {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) throw ApiError.notFound("Note not found");

    const { role, sub } = req.user!;
    if (!isStaff(role)) {
      const own = note.uploadedById === sub;
      let visible = own || (note.status === "APPROVED" && note.sectionId === null);
      if (!visible && note.status === "APPROVED" && note.sectionId) {
        const student = await prisma.student.findUnique({ where: { userId: sub } });
        visible = student?.sectionId === note.sectionId;
      }
      if (!visible) throw ApiError.forbidden();
    }

    const path = join(notesDir(), basename(note.fileName));
    if (!existsSync(path)) throw ApiError.notFound("File missing");
    res.setHeader("Content-Type", note.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${note.originalName.replace(/"/g, "")}"`
    );
    createReadStream(path).pipe(res);
  })
);

// ── Delete (owner or admin) ─────────────────────────────────────────────────
notesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) throw ApiError.notFound("Note not found");
    const { role, sub } = req.user!;
    const canDelete = role === "SUPER_ADMIN" || role === "ADMIN" || note.uploadedById === sub;
    if (!canDelete) throw ApiError.forbidden();

    await prisma.note.delete({ where: { id: note.id } });
    unlink(join(notesDir(), basename(note.fileName)), () => {}); // best-effort file cleanup
    res.status(204).end();
  })
);
