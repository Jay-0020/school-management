import { describe, expect, it } from "vitest";
import { todayInZone, utcMidnight } from "../src/lib/calendar";

describe("todayInZone — IST date keying (B5)", () => {
  it("keys to the IST civil date, not the UTC day, in the 00:00–05:30 window", () => {
    // 2026-06-28 20:30 UTC === 2026-06-29 02:00 IST
    const now = new Date("2026-06-28T20:30:00.000Z");
    expect(todayInZone("Asia/Kolkata", now).toISOString()).toBe(
      "2026-06-29T00:00:00.000Z"
    );
    // the old utcMidnight(new Date()) would mis-key this to the 28th:
    expect(utcMidnight(now).toISOString()).toBe("2026-06-28T00:00:00.000Z");
  });

  it("agrees with the UTC day during daytime hours", () => {
    const now = new Date("2026-06-29T09:00:00.000Z"); // 14:30 IST, same date
    expect(todayInZone("Asia/Kolkata", now).toISOString()).toBe(
      "2026-06-29T00:00:00.000Z"
    );
  });

  it("respects other timezones", () => {
    const now = new Date("2026-06-28T20:30:00.000Z");
    expect(todayInZone("UTC", now).toISOString()).toBe("2026-06-28T00:00:00.000Z");
  });
});
