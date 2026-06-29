import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, loginAs } from "./helpers";

let auth: Awaited<ReturnType<typeof loginAs>>;

beforeAll(async () => {
  await db.user.update({ where: { email: ADMIN.email }, data: { mustChangePassword: false } });
  auth = await loginAs(ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("notes uploads are namespaced per tenant (D2)", () => {
  it("stores the file under uploads/<tenant-db>/notes, not a shared dir", async () => {
    const res = await auth
      .post("/api/notes")
      .set("Host", HOST)
      .field("title", "Tenant note")
      .attach("file", Buffer.from("hello notes"), "note.txt");
    expect(res.status).toBe(201);
    const fileName = res.body.fileName as string;

    // The per-tenant path exists …
    const perTenant = join(process.cwd(), "uploads", "school_test", "notes", fileName);
    expect(existsSync(perTenant)).toBe(true);
    // … and the old shared path does NOT.
    const sharedOld = join(process.cwd(), "uploads", "notes", fileName);
    expect(existsSync(sharedOld)).toBe(false);

    // Round-trip: it downloads correctly from the per-tenant dir.
    const dl = await auth.get(`/api/notes/${res.body.id}/download`).set("Host", HOST);
    expect(dl.status).toBe(200);
    expect(dl.text).toBe("hello notes");
  });
});

describe("Razorpay config is per tenant (D1)", () => {
  it("reports online pay enabled only for the tenant that carries keys", async () => {
    // test.localhost has NO razorpay keys → disabled.
    const off = await auth.get("/api/fees/online/config").set("Host", HOST);
    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);

    // rzp.localhost carries keys in the registry → enabled, with its own keyId.
    const on = await auth.get("/api/fees/online/config").set("Host", "rzp.localhost");
    expect(on.status).toBe(200);
    expect(on.body.enabled).toBe(true);
    expect(on.body.keyId).toBe("rzp_test_DUMMYKEY123");
    expect(on.body.feePercent).toBe(3); // per-tenant convenience %
  });
});
