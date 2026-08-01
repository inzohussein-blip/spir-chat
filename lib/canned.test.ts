import { describe, it, expect } from "vitest";
import { filterCannedResponses, isCannedShortcut } from "./canned";

const items = [
  { id: "1", short_code: "hi", content: "Hello there!" },
  { id: "2", short_code: "bye", content: "Thanks for reaching out." },
  { id: "3", short_code: "hours", content: "We're open 9-5." },
];

describe("filterCannedResponses", () => {
  it("returns all items for an empty query", () => {
    expect(filterCannedResponses(items, "")).toHaveLength(3);
    expect(filterCannedResponses(items, "  ")).toHaveLength(3);
  });

  it("matches on the short code", () => {
    // "hours" only appears as a short code, not inside any content.
    expect(filterCannedResponses(items, "hours").map((i) => i.id)).toEqual(["3"]);
  });

  it("treats a leading slash as the shortcut prefix", () => {
    expect(filterCannedResponses(items, "/bye").map((i) => i.id)).toEqual(["2"]);
  });

  it("matches on content, case-insensitively", () => {
    expect(filterCannedResponses(items, "THANKS").map((i) => i.id)).toEqual(["2"]);
  });
});

describe("isCannedShortcut", () => {
  it("detects a shortcut token", () => {
    expect(isCannedShortcut("/hi")).toBe(true);
    expect(isCannedShortcut("/")).toBe(true);
  });

  it("rejects normal text or slashes mid-sentence", () => {
    expect(isCannedShortcut("hello")).toBe(false);
    expect(isCannedShortcut("/hi there")).toBe(false);
    expect(isCannedShortcut("")).toBe(false);
  });
});
