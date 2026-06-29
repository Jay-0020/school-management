import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { Role } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { HOST, db, http, loginAs } from "./helpers";

async function makeUser(role: Role, mustChangePassword: boolean, password = "Pass@1234") {
  const email = `sec-${randomUUID().slice(0, 8)}@test.local`;
  await db.user.create({
    data: { email, passwordHash: await argon2.hash(password), role, mustChangePassword },
  });
  return { email, password };
}

afterAll(async () => {
  await db.$disconnect();
});

describe("security — cookies, forced password change, session revocation", () => {
  it("marks the auth cookie Secure only over HTTPS, regardless of NODE_ENV (C1)", async () => {
    const { email, password } = await makeUser("TEACHER", false);

    const https = await http()
      .post("/api/auth/login")
      .set("Host", HOST)
      .set("X-Forwarded-Proto", "https") // trusted proxy → req.secure = true
      .send({ email, password });
    expect(https.status).toBe(200);
    expect((https.headers["set-cookie"] ?? []).join(";")).toMatch(/Secure/);

    const plain = await http().post("/api/auth/login").set("Host", HOST).send({ email, password });
    expect((plain.headers["set-cookie"] ?? []).join(";")).not.toMatch(/Secure/);
  });

  it("blocks the API until a forced password change is completed (C2)", async () => {
    const { email, password } = await makeUser("TEACHER", true);
    const agent = await loginAs(email, password); // login itself is allowed

    // A normal protected route is blocked while a change is pending …
    const blocked = await agent.get("/api/notices").set("Host", HOST);
    expect(blocked.status).toBe(403);

    // … but the change-password / me endpoints stay reachable.
    const me = await agent.get("/api/auth/me").set("Host", HOST);
    expect(me.status).toBe(200);

    const changed = await agent
      .post("/api/auth/change-password")
      .set("Host", HOST)
      .send({ currentPassword: password, newPassword: "NewPass@1234" });
    expect(changed.status).toBe(200);

    // Now unblocked (fresh token with mcp cleared was issued by change-password).
    const ok = await agent.get("/api/notices").set("Host", HOST);
    expect(ok.status).toBe(200);
  });

  it("revokes other sessions when the password changes (C3)", async () => {
    const { email, password } = await makeUser("TEACHER", false);
    const session1 = await loginAs(email, password);
    const session2 = await loginAs(email, password);

    // session2 can refresh before the change.
    const before = await session2.post("/api/auth/refresh").set("Host", HOST).send({});
    expect(before.status).toBe(200);

    // session1 changes the password …
    const changed = await session1
      .post("/api/auth/change-password")
      .set("Host", HOST)
      .send({ currentPassword: password, newPassword: "NewPass@1234" });
    expect(changed.status).toBe(200);

    // … which revokes session2's refresh token → it can no longer refresh.
    const after = await session2.post("/api/auth/refresh").set("Host", HOST).send({});
    expect(after.status).toBe(401);
  });
});
