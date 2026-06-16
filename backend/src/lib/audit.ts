import type { Request } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | null;
  action: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
}

/** Write an audit entry. Fire-and-forget — never blocks or fails the request. */
export function logAudit(input: AuditInput): void {
  prisma.auditLog
    .create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        summary: input.summary,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
      },
    })
    .catch(() => {
      /* auditing must never break the actual operation */
    });
}

/** Convenience for authenticated routes: takes the actor from req.user. */
export function audit(
  req: Request,
  action: string,
  summary: string,
  entity?: { type?: string; id?: string }
): void {
  logAudit({
    actorId: req.user?.sub,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    action,
    summary,
    entityType: entity?.type,
    entityId: entity?.id,
    ip: req.ip,
  });
}
