import { describe, it, expect } from "vitest";
import {
  normalizePriority,
  isPriorityLevel,
  comparePriority,
  PRIORITY_LABEL,
} from "./priority";

describe("priority", () => {
  it("recognizes valid levels", () => {
    expect(isPriorityLevel(0)).toBe(true);
    expect(isPriorityLevel(2)).toBe(true);
    expect(isPriorityLevel(3)).toBe(false);
    expect(isPriorityLevel("1")).toBe(false);
  });

  it("normalizes out-of-range/garbage to normal", () => {
    expect(normalizePriority(1)).toBe(1);
    expect(normalizePriority(99)).toBe(0);
    expect(normalizePriority(null)).toBe(0);
    expect(normalizePriority(undefined)).toBe(0);
  });

  it("labels each level", () => {
    expect(PRIORITY_LABEL[2]).toBe("Urgent");
  });

  it("sorts urgent first, then by recency", () => {
    const rows = [
      { priority: 0, at: "2026-01-03T00:00:00Z" },
      { priority: 2, at: "2026-01-01T00:00:00Z" },
      { priority: 1, at: "2026-01-02T00:00:00Z" },
      { priority: 2, at: "2026-01-02T00:00:00Z" },
    ];
    const sorted = [...rows].sort(comparePriority);
    expect(sorted.map((r) => r.priority)).toEqual([2, 2, 1, 0]);
    // Within urgent, the newer one wins.
    expect(sorted[0].at).toBe("2026-01-02T00:00:00Z");
  });

  it("treats missing priority as normal when sorting", () => {
    const sorted = [
      { at: "2026-01-01T00:00:00Z" },
      { priority: 1, at: "2026-01-01T00:00:00Z" },
    ].sort(comparePriority);
    expect(normalizePriority(sorted[0].priority)).toBe(1);
  });
});
