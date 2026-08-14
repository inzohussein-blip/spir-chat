import { describe, it, expect } from "vitest";
import { parseFormFields, validateAnswer } from "./forms";

describe("parseFormFields", () => {
  it("keeps labeled fields, normalizes keys and types", () => {
    const fields = parseFormFields([
      { key: "Full Name!", label: "Your name", type: "text", required: true },
      { label: "Email", type: "email" },
      { type: "number" }, // no label → dropped
      "junk",
    ]);
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe("full_name");
    expect(fields[0].required).toBe(true);
    expect(fields[1].key).toBe("field_2");
    expect(fields[1].type).toBe("email");
  });

  it("falls back to text for unknown types", () => {
    const [f] = parseFormFields([{ label: "X", type: "date" }]);
    expect(f.type).toBe("text");
  });
});

describe("validateAnswer", () => {
  const email = { key: "e", label: "Email", type: "email" as const, required: true };
  const optional = { key: "n", label: "Note", type: "text" as const, required: false };

  it("requires required fields", () => {
    expect(validateAnswer(email, "")).toMatch(/required/i);
    expect(validateAnswer(optional, "")).toBeNull();
  });

  it("validates emails and numbers", () => {
    expect(validateAnswer(email, "bad")).toMatch(/valid email/i);
    expect(validateAnswer(email, "a@b.co")).toBeNull();
    const num = { key: "q", label: "Qty", type: "number" as const, required: true };
    expect(validateAnswer(num, "abc")).toMatch(/number/i);
    expect(validateAnswer(num, "42")).toBeNull();
  });
});
