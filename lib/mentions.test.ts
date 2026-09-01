import { describe, it, expect } from "vitest";
import { findMentions, mentionTokens } from "./mentions";

const members = [
  { userId: "u1", tokens: ["ana", "ana"] },
  { userId: "u2", tokens: ["bob"] },
  { userId: "u3", tokens: ["anabel"] },
];

describe("findMentions", () => {
  it("matches @token on a word boundary", () => {
    expect(findMentions("hey @ana can you look?", members)).toEqual(["u1"]);
  });

  it("does not match a longer name (@ana ≠ anabel)", () => {
    expect(findMentions("@anabel please", members)).toEqual(["u3"]);
  });

  it("matches multiple distinct mentions", () => {
    expect(findMentions("@ana and @bob", members).sort()).toEqual(["u1", "u2"]);
  });

  it("returns [] when there is no @", () => {
    expect(findMentions("no mentions here", members)).toEqual([]);
  });
});

describe("mentionTokens", () => {
  it("derives tokens from email local part and first name", () => {
    expect(mentionTokens("sara.k@x.com", "Sara Khan")).toEqual(["sara.k", "Sara"]);
  });
  it("handles missing values", () => {
    expect(mentionTokens(null, null)).toEqual([]);
    expect(mentionTokens("a@b.com")).toEqual(["a"]);
  });
});
