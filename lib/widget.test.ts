import { describe, it, expect } from "vitest";
import {
  sanitizeWidgetText,
  isValidVisitorId,
  visitorSenderId,
  mapDbMessageToWidget,
  WIDGET_MAX_TEXT_LENGTH,
} from "./widget";

describe("sanitizeWidgetText", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeWidgetText("  hi  ")).toBe("hi");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(sanitizeWidgetText("")).toBeNull();
    expect(sanitizeWidgetText("   ")).toBeNull();
  });

  it("returns null for non-strings", () => {
    expect(sanitizeWidgetText(undefined)).toBeNull();
    expect(sanitizeWidgetText(42)).toBeNull();
    expect(sanitizeWidgetText({})).toBeNull();
  });

  it("truncates over-long input instead of rejecting it", () => {
    const long = "a".repeat(WIDGET_MAX_TEXT_LENGTH + 500);
    expect(sanitizeWidgetText(long)).toHaveLength(WIDGET_MAX_TEXT_LENGTH);
  });
});

describe("isValidVisitorId", () => {
  it("accepts a v4-style uuid", () => {
    expect(isValidVisitorId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("rejects malformed ids and non-strings", () => {
    expect(isValidVisitorId("not-a-uuid")).toBe(false);
    expect(isValidVisitorId("web:f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(
      false
    );
    expect(isValidVisitorId(null)).toBe(false);
    expect(isValidVisitorId(123)).toBe(false);
  });
});

describe("visitorSenderId", () => {
  it("namespaces the visitor id under the web: prefix", () => {
    expect(visitorSenderId("abc")).toBe("web:abc");
  });
});

describe("mapDbMessageToWidget", () => {
  it("exposes only the safe public fields", () => {
    const mapped = mapDbMessageToWidget({
      id: "m1",
      direction: "outbound",
      text: "hello",
      created_at: "2026-01-01T00:00:00Z",
      // extra internal fields must not leak through
      ...({ sent_by_user_id: "secret", workspace_id: "ws" } as object),
    } as never);

    expect(mapped).toEqual({
      id: "m1",
      direction: "outbound",
      text: "hello",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(mapped).not.toHaveProperty("sent_by_user_id");
  });
});
