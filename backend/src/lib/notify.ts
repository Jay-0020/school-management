import { prisma } from "./prisma";

/** Create an in-app notification for a user (best-effort; never throws). */
export async function notify(userId: string, message: string, link?: string) {
  try {
    await prisma.notification.create({ data: { userId, message, link: link ?? null } });
  } catch (err) {
    console.error("notify failed:", err);
  }
}

/** Notify several users at once. */
export async function notifyMany(userIds: string[], message: string, link?: string) {
  await Promise.all(userIds.map((id) => notify(id, message, link)));
}
