import { describe, it, expect } from "vitest";
import {
  extractFirstUrl,
  isValidUrl,
  buildTrackedUrl,
  renderMessageWithTracking,
  generateTrackedLinkSlug,
} from "./tracking";

describe("extractFirstUrl", () => {
  it("finds a URL and trims trailing punctuation", () => {
    expect(extractFirstUrl("see https://a.com/x. thanks")).toBe("https://a.com/x");
    expect(extractFirstUrl("no url here")).toBeNull();
  });
});

describe("isValidUrl", () => {
  it("accepts http/https, rejects others", () => {
    expect(isValidUrl("https://a.com")).toBe(true);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("buildTrackedUrl", () => {
  it("builds /r/<slug> under the base", () => {
    expect(buildTrackedUrl("abc", "https://app.example")).toBe(
      "https://app.example/r/abc"
    );
    expect(buildTrackedUrl("abc", "https://app.example/")).toBe(
      "https://app.example/r/abc"
    );
  });
});

describe("renderMessageWithTracking", () => {
  it("replaces {username} and strips {link} when no tracked link", () => {
    expect(
      renderMessageWithTracking({ message: "Hi {username} {link}", recipientName: "Sam" })
    ).toBe("Hi Sam");
  });

  it("defaults username to 'there'", () => {
    expect(renderMessageWithTracking({ message: "Hi {username}" })).toBe("Hi there");
  });

  it("substitutes {link} with the tracked URL", () => {
    const out = renderMessageWithTracking({
      message: "Grab it: {link}",
      recipientName: "Sam",
      trackedLink: { slug: "abc", destinationUrl: "https://shop.example" },
      baseUrl: "https://app.example",
    });
    expect(out).toBe("Grab it: https://app.example/r/abc");
  });

  it("swaps an inline destination URL for the tracked URL", () => {
    const out = renderMessageWithTracking({
      message: "Buy at https://shop.example now",
      trackedLink: { slug: "xy", destinationUrl: "https://shop.example" },
      baseUrl: "https://app.example",
    });
    expect(out).toContain("https://app.example/r/xy");
    expect(out).not.toContain("shop.example now".replace(" now", ""));
  });
});

describe("generateTrackedLinkSlug", () => {
  it("produces distinct URL-safe slugs", () => {
    const a = generateTrackedLinkSlug();
    const b = generateTrackedLinkSlug();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
