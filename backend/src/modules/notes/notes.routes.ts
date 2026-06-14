import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, createReadStream, unlink } from "node:fs";
import { extname, join } from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const notesRouter = Router();

const UPLOAD_DIR = join(process.cwd(), "uploads", "notes");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

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
    destination: UPLOAD_DIR,
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

// ── Upload ──────────────────────────────────────────────────────────────────
notesRouter.post(
  "/",
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

    // Staff uploads are auto-approved; student uploads await moderation.
    const status = isStaff(req.user!.role) ? "APPROVED" : "PENDING";

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
        status,
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
    const q = req.query.q ? String(req.query.q) : undefined;
    let where: Prisma.NoteWhereInput = {};

    if (isStaff(role)) {
      if (req.query.status) where.status = req.query.status as Prisma.NoteWhereInput["status"];
      if (req.query.sectionId) where.sectionId = String(req.query.sectionId);
    } else {
      // students/parents: approved notes for their section or school-wide, plus their own
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      const visible: Prisma.NoteWhereInput[] = [
        { status: "APPROVED", sectionId: null },
        { uploadedById: sub },
      ];
      if (student?.sectionId)
        visible.push({ status: "APPROVED", sectionId: student.sectionId });
      where = { OR: visible };
    }
    if (q) where = { AND: [where, { title: { contains: q, mode: "insensitive" } }] };

    const items = await prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include,
    });
    res.json({ items });
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

    const path = join(UPLOAD_DIR, note.fileName);
    if (!existsSync(path)) throw ApiError.notFound("File missing");
    res.setHeader("Content-Type", note.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${note.originalName.replace(/"/g, "")}"`
    );
    createReadStream(path).pipe(res);
  })
);

// ── Moderate ────────────────────────────────────────────────────────────────
notesRouter.post(
  "/:id/moderate",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const { decision } = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }).parse(req.body);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) throw ApiError.notFound("Note not found");
    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { status: decision },
      include,
    });
    res.json(updated);
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
    unlink(join(UPLOAD_DIR, note.fileName), () => {}); // best-effort file cleanup
    res.status(204).end();
  })
);
