import { describe, it, expect } from "vitest";
import { parseBusinessHours, isOpenAt } from "./business-hours";

describe("parseBusinessHours", () => {
  it("fills defaults and 7 days", () => {
    const bh = parseBusinessHours({});
    expect(bh.enabled).toBe(false);
    expect(bh.days).toHaveLength(7);
    expect(bh.timezone).toBeTruthy();
  });

  it("reads enabled, timezone, offline reply, and per-day times", () => {
    const bh = parseBusinessHours({
      enabled: true,
      timezone: "Asia/Riyadh",
      replyOffline: "  closed  ",
      days: [{ open: true, from: "08:00", to: "12:00" }],
    });
    expect(bh.enabled).toBe(true);
    expect(bh.timezone).toBe("Asia/Riyadh");
    expect(bh.replyOffline).toBe("closed");
    expect(bh.days[0]).toEqual({ open: true, from: "08:00", to: "12:00" });
  });

  it("rejects malformed times, keeping the default", () => {
    const bh = parseBusinessHours({ days: [{ open: true, from: "9am", to: "25:00" }] });
    expect(bh.days[0].from).toBe("09:00");
    expect(bh.days[0].to).toBe("17:00");
  });
});

describe("isOpenAt", () => {
  it("is always open when disabled", () => {
    const bh = parseBusinessHours({ enabled: false });
    expect(isOpenAt(bh, new Date("2026-01-01T03:00:00Z"))).toBe(true);
  });

  it("respects the day's window in the configured timezone", () => {
    // Thursday 2026-01-01. Open Thu 09:00–17:00 UTC.
    const bh = parseBusinessHours({
      enabled: true,
      timezone: "UTC",
      days: [
        { open: false, from: "09:00", to: "17:00" }, // Sun
        { open: false, from: "09:00", to: "17:00" },
        { open: false, from: "09:00", to: "17:00" },
        { open: false, from: "09:00", to: "17:00" },
        { open: true, from: "09:00", to: "17:00" }, // Thu
        { open: false, from: "09:00", to: "17:00" },
        { open: false, from: "09:00", to: "17:00" },
      ],
    });
    expect(isOpenAt(bh, new Date("2026-01-01T10:00:00Z"))).toBe(true);
    expect(isOpenAt(bh, new Date("2026-01-01T18:00:00Z"))).toBe(false);
    expect(isOpenAt(bh, new Date("2026-01-01T08:00:00Z"))).toBe(false);
  });

  it("handles overnight windows that wrap past midnight", () => {
    const days = Array.from({ length: 7 }, () => ({
      open: true,
      from: "22:00",
      to: "06:00",
    }));
    const bh = parseBusinessHours({ enabled: true, timezone: "UTC", days });
    expect(isOpenAt(bh, new Date("2026-01-01T23:00:00Z"))).toBe(true);
    expect(isOpenAt(bh, new Date("2026-01-01T03:00:00Z"))).toBe(true);
    expect(isOpenAt(bh, new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });
});
