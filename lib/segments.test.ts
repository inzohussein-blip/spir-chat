import { describe, it, expect } from "vitest";
import {
  parseSegmentRules,
  ruleMatches,
  matchesSegment,
  segmentFilters,
  applySegment,
  operatorsFor,
  type SegmentContact,
  type SegmentRule,
} from "./segments";

const base: SegmentContact = {
  display_name: "Sara",
  email: "sara@example.com",
  phone: null,
  is_subscribed: true,
  last_interaction_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
};

describe("parseSegmentRules", () => {
  it("keeps only well-formed rules with known fields", () => {
    const rules = parseSegmentRules([
      { field: "email", operator: "is_set" },
      { field: "unknown", operator: "is_set" },
      { operator: "is_set" },
      "junk",
      null,
      { field: "phone", operator: "equals", value: "123" },
    ]);
    expect(rules).toEqual([
      { field: "email", operator: "is_set", value: undefined },
      { field: "phone", operator: "equals", value: "123" },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(parseSegmentRules(null)).toEqual([]);
    expect(parseSegmentRules({})).toEqual([]);
  });
});

describe("ruleMatches", () => {
  it("handles is_set / is_not_set", () => {
    expect(ruleMatches(base, { field: "email", operator: "is_set" })).toBe(true);
    expect(ruleMatches(base, { field: "phone", operator: "is_set" })).toBe(false);
    expect(ruleMatches(base, { field: "phone", operator: "is_not_set" })).toBe(true);
  });

  it("handles boolean operators", () => {
    expect(ruleMatches(base, { field: "is_subscribed", operator: "is_true" })).toBe(true);
    expect(ruleMatches(base, { field: "is_subscribed", operator: "is_false" })).toBe(false);
  });

  it("handles equals/contains case-insensitively", () => {
    expect(ruleMatches(base, { field: "display_name", operator: "equals", value: "sara" })).toBe(true);
    expect(ruleMatches(base, { field: "email", operator: "contains", value: "EXAMPLE" })).toBe(true);
    expect(ruleMatches(base, { field: "email", operator: "not_equals", value: "other@x.com" })).toBe(true);
  });

  it("handles date operators", () => {
    expect(ruleMatches(base, { field: "last_interaction_at", operator: "in_last_days", value: "7" })).toBe(true);
    expect(ruleMatches(base, { field: "last_interaction_at", operator: "in_last_days", value: "1" })).toBe(false);
    expect(ruleMatches(base, { field: "created_at", operator: "before", value: new Date().toISOString() })).toBe(true);
  });
});

describe("matchesSegment", () => {
  it("empty rules match everyone", () => {
    expect(matchesSegment(base, [])).toBe(true);
  });
  it("ANDs all rules", () => {
    const rules: SegmentRule[] = [
      { field: "is_subscribed", operator: "is_true" },
      { field: "email", operator: "is_set" },
    ];
    expect(matchesSegment(base, rules)).toBe(true);
    expect(matchesSegment({ ...base, email: null }, rules)).toBe(false);
  });
});

describe("segmentFilters", () => {
  it("maps operators to PostgREST filter methods", () => {
    expect(segmentFilters([{ field: "email", operator: "is_set" }])).toEqual([
      { method: "not", column: "email", notOp: "is", value: null },
    ]);
    expect(segmentFilters([{ field: "display_name", operator: "contains", value: "sa" }])).toEqual([
      { method: "ilike", column: "display_name", value: "%sa%" },
    ]);
    expect(segmentFilters([{ field: "is_subscribed", operator: "is_true" }])).toEqual([
      { method: "eq", column: "is_subscribed", value: true },
    ]);
  });
});

describe("applySegment", () => {
  it("chains the right builder methods in order", () => {
    const calls: string[] = [];
    const q = {
      eq(c: string, v: unknown) { calls.push(`eq:${c}:${v}`); return this; },
      neq(c: string, v: unknown) { calls.push(`neq:${c}:${v}`); return this; },
      ilike(c: string, v: string) { calls.push(`ilike:${c}:${v}`); return this; },
      is(c: string, v: unknown) { calls.push(`is:${c}:${v}`); return this; },
      not(c: string, op: string, v: unknown) { calls.push(`not:${c}:${op}:${v}`); return this; },
      lt(c: string, v: unknown) { calls.push(`lt:${c}:${v}`); return this; },
      gt(c: string, v: unknown) { calls.push(`gt:${c}:${v}`); return this; },
      gte(c: string, v: unknown) { calls.push(`gte:${c}:${v}`); return this; },
    };
    applySegment(q, [
      { field: "is_subscribed", operator: "is_true" },
      { field: "email", operator: "is_set" },
    ]);
    expect(calls).toEqual(["eq:is_subscribed:true", "not:email:is:null"]);
  });
});

describe("operatorsFor", () => {
  it("returns kind-appropriate operators", () => {
    expect(operatorsFor("is_subscribed")).toEqual(["is_true", "is_false"]);
    expect(operatorsFor("created_at")).toContain("in_last_days");
    expect(operatorsFor("email")).toContain("contains");
  });
});
