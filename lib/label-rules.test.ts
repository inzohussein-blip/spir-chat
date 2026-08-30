import { describe, it, expect } from "vitest";
import { matchLabelRules } from "./label-rules";

const rules = [
  { keyword: "refund", label_id: "L1" },
  { keyword: "Pricing", label_id: "L2" },
  { keyword: "", label_id: "L3" },
];

describe("matchLabelRules", () => {
  it("matches case-insensitive substrings", () => {
    expect(matchLabelRules(rules, "I want a REFUND please")).toEqual(["L1"]);
    expect(matchLabelRules(rules, "what is your pricing?")).toEqual(["L2"]);
  });

  it("returns multiple distinct labels", () => {
    expect(matchLabelRules(rules, "refund and pricing").sort()).toEqual(["L1", "L2"]);
  });

  it("ignores empty keywords and empty text", () => {
    expect(matchLabelRules(rules, "hello")).toEqual([]);
    expect(matchLabelRules(rules, null)).toEqual([]);
    expect(matchLabelRules(rules, "")).toEqual([]);
  });

  it("dedupes when two rules point at the same label", () => {
    const r = [
      { keyword: "buy", label_id: "L1" },
      { keyword: "purchase", label_id: "L1" },
    ];
    expect(matchLabelRules(r, "I want to buy / purchase")).toEqual(["L1"]);
  });
});
