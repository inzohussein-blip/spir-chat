import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_TEMPLATES,
  getCampaignTemplate,
} from "./campaign-templates";

describe("campaign templates", () => {
  it("all have unique ids", () => {
    const ids = CAMPAIGN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all have a name, description, and body", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(t.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("email templates carry a subject; SMS/WhatsApp don't", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      if (t.channel === "email") {
        expect(t.subject.trim().length).toBeGreaterThan(0);
      } else {
        expect(t.subject).toBe("");
      }
    }
  });

  it("only use supported channels", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(["email", "sms", "whatsapp"]).toContain(t.channel);
    }
  });

  it("looks up a template by id", () => {
    expect(getCampaignTemplate("welcome")?.name).toBe("Welcome");
    expect(getCampaignTemplate("nope")).toBeUndefined();
  });
});
