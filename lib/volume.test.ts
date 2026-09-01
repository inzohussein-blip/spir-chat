import { describe, it, expect } from "vitest";
import { dailyBuckets, hourlyBuckets } from "./volume";

const DAY = 24 * 60 * 60 * 1000;

describe("dailyBuckets", () => {
  it("returns `days` zero-filled buckets oldest-first", () => {
    const b = dailyBuckets([], 7);
    expect(b).toHaveLength(7);
    expect(b.every((x) => x.count === 0)).toBe(true);
    expect(b[0].day).toBeLessThan(b[6].day);
  });

  it("counts today and yesterday into the right buckets", () => {
    const now = new Date();
    const yesterday = new Date(Date.now() - DAY);
    const b = dailyBuckets([now.toISOString(), now.toISOString(), yesterday.toISOString()], 3);
    expect(b[2].count).toBe(2); // today (last bucket)
    expect(b[1].count).toBe(1); // yesterday
    expect(b[0].count).toBe(0);
  });

  it("ignores dates outside the window and invalid input", () => {
    const old = new Date(Date.now() - 30 * DAY).toISOString();
    const b = dailyBuckets([old, "not-a-date"], 7);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(0);
  });
});

describe("hourlyBuckets", () => {
  it("buckets by local hour of day", () => {
    const d = new Date();
    d.setHours(14, 30, 0, 0);
    const h = hourlyBuckets([d.toISOString(), d.toISOString()]);
    expect(h).toHaveLength(24);
    expect(h[14]).toBe(2);
    expect(h.reduce((a, b) => a + b, 0)).toBe(2);
  });
});
