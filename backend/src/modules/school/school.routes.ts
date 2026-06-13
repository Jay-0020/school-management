import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const schoolRouter = Router();

/**
 * Public branding — the SPA fetches this before login to theme the app
 * (name, logo, colour). Drives the white-label experience.
 */
schoolRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.schoolSettings.findFirst();
    if (!settings) throw ApiError.notFound("School not configured");
    res.json({
      name: settings.name,
      shortName: settings.shortName,
      primaryColor: settings.primaryColor,
      logoUrl: settings.logoUrl,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      currency: settings.currency,
      timezone: settings.timezone,
      academicYear: settings.academicYear,
    });
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  academicYear: z.string().optional(),
});

schoolRouter.put(
  "/settings",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const settings = await prisma.schoolSettings.update({ where: { id: 1 }, data });
    res.json(settings);
  })
);
