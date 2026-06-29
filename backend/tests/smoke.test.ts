import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, http } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("harness smoke", () => {
  it("health endpoint responds on any host", async () => {
    const res = await http().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects API calls on an unknown school domain", async () => {
    const res = await http().get("/api/school/settings").set("Host", "nope.localhost");
    expect(res.status).toBe(404);
  });

  it("serves branding for the test tenant", async () => {
    const res = await http().get("/api/school/settings").set("Host", HOST);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
  });

  it("logs in the seeded admin", async () => {
    const res = await http()
      .post("/api/auth/login")
      .set("Host", HOST)
      .send(ADMIN);
    expect(res.status).toBe(200);
    // auth cookie is set httpOnly
    expect(res.headers["set-cookie"]?.join(";")).toMatch(/token=/);
  });

  it("test DB is reachable directly for seeding/asserts", async () => {
    const settings = await db.schoolSettings.findFirst();
    expect(settings).not.toBeNull();
  });
});
