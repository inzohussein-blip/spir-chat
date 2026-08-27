import { describe, it, expect } from "vitest";
import { renderMergeVariables, mergeValue } from "./merge";

const contact = { display_name: "Sara Ali", email: "sara@example.com", phone: "+100" };

describe("mergeValue", () => {
  it("derives first_name from the display name", () => {
    expect(mergeValue(contact, "first_name")).toBe("Sara");
    expect(mergeValue({ display_name: null }, "first_name")).toBeNull();
  });
  it("resolves name/email/phone", () => {
    expect(mergeValue(contact, "name")).toBe("Sara Ali");
    expect(mergeValue(contact, "email")).toBe("sara@example.com");
    expect(mergeValue(contact, "phone")).toBe("+100");
  });
  it("returns null for unknown keys and empty values", () => {
    expect(mergeValue(contact, "nope")).toBeNull();
    expect(mergeValue({ email: "" }, "email")).toBeNull();
  });
});

describe("renderMergeVariables", () => {
  it("substitutes known variables", () => {
    expect(renderMergeVariables("Hi {{first_name}}!", contact)).toBe("Hi Sara!");
    expect(renderMergeVariables("{{name}} <{{email}}>", contact)).toBe("Sara Ali <sara@example.com>");
  });

  it("uses the fallback when a value is missing", () => {
    expect(renderMergeVariables("Hi {{first_name|there}}", { display_name: null })).toBe("Hi there");
    expect(renderMergeVariables("Hi {{first_name | friend}}", {})).toBe("Hi friend");
  });

  it("drops an unresolved variable with no fallback", () => {
    expect(renderMergeVariables("Hi {{first_name}}!", {})).toBe("Hi !");
    expect(renderMergeVariables("x {{unknown}} y", contact)).toBe("x  y");
  });

  it("is case-insensitive and tolerates spacing", () => {
    expect(renderMergeVariables("{{ FIRST_NAME }}", contact)).toBe("Sara");
  });

  it("keeps the legacy {username} token working", () => {
    expect(renderMergeVariables("Hey {username}", contact)).toBe("Hey Sara");
    expect(renderMergeVariables("Hey {username}", {})).toBe("Hey there");
  });

  it("leaves text without tokens unchanged", () => {
    expect(renderMergeVariables("plain text", contact)).toBe("plain text");
  });
});
