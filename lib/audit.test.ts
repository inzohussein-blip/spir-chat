import { describe, it, expect } from "vitest";
import { describeAudit } from "./audit";

describe("describeAudit", () => {
  it("names the actor, verb, and quoted target", () => {
    expect(
      describeAudit({ action: "contact.erased", actorLabel: "Omar", targetLabel: "Sara Ali" })
    ).toBe("Omar erased contact “Sara Ali”");
  });

  it("omits the target when absent", () => {
    expect(
      describeAudit({ action: "settings.updated", actorLabel: "Omar" })
    ).toBe("Omar updated settings");
  });

  it("falls back to “Someone” with no actor", () => {
    expect(describeAudit({ action: "member.removed", targetLabel: "x@y.com" })).toBe(
      "Someone removed member “x@y.com”"
    );
  });

  it("humanizes an unknown action key", () => {
    expect(describeAudit({ action: "widget.published", actorLabel: "A" })).toBe(
      "A widget published"
    );
  });
});
