import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";

// One app instance + one direct Prisma client (for seeding/asserting) bound to
// the same test DB the app's tenant resolver points at.
export const app = createApp();
export const HOST = "test.localhost";
export const TEST_DB_URL =
  "postgresql://school:school@localhost:5432/school_test?schema=public";

export const db = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

/** Supertest request with the tenant Host header pre-set. */
export function http() {
  return request(app);
}

/** A cookie-jar agent (keeps the auth cookie across requests). */
export function agent() {
  return request.agent(app);
}

/** Log in the seeded admin and return an authenticated agent. */
export async function loginAs(
  email: string,
  password: string
): Promise<ReturnType<typeof request.agent>> {
  const a = request.agent(app);
  const res = await a.post("/api/auth/login").set("Host", HOST).send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return a;
}

export const ADMIN = { email: "admin@demoschool.in", password: "ChangeMe!123" };
