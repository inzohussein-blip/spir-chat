import { describe, it, expect } from "vitest";
import {
  parseMacroActions,
  validMacroActions,
  actionNeedsValue,
  type MacroAction,
} from "./macros";

describe("parseMacroActions", () => {
  it("keeps only well-formed actions with known types", () => {
    const actions = parseMacroActions([
      { type: "send_message", value: "hi" },
      { type: "unknown", value: "x" },
      { type: "assign" },
      "junk",
      null,
      { type: "set_status", value: "closed" },
    ]);
    expect(actions).toEqual([
      { type: "send_message", value: "hi" },
      { type: "assign", value: "" },
      { type: "set_status", value: "closed" },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(parseMacroActions(null)).toEqual([]);
    expect(parseMacroActions({})).toEqual([]);
  });
});

describe("validMacroActions", () => {
  it("drops actions missing a required value", () => {
    const actions: MacroAction[] = [
      { type: "send_message", value: "" },
      { type: "send_message", value: "hello" },
      { type: "add_label", value: "" },
      { type: "add_label", value: "lbl-1" },
    ];
    expect(validMacroActions(actions)).toEqual([
      { type: "send_message", value: "hello" },
      { type: "add_label", value: "lbl-1" },
    ]);
  });

  it("keeps assign with an empty value (means unassign)", () => {
    expect(validMacroActions([{ type: "assign", value: "" }])).toEqual([
      { type: "assign", value: "" },
    ]);
  });

  it("only accepts valid statuses", () => {
    expect(validMacroActions([{ type: "set_status", value: "closed" }])).toHaveLength(1);
    expect(validMacroActions([{ type: "set_status", value: "bogus" }])).toHaveLength(0);
  });
});

describe("actionNeedsValue", () => {
  it("assign never requires a value", () => {
    expect(actionNeedsValue("assign")).toBe(false);
    expect(actionNeedsValue("send_message")).toBe(true);
    expect(actionNeedsValue("set_status")).toBe(true);
  });
});
