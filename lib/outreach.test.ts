import { describe, it, expect } from "vitest";
import { normalizePhone, parseRecipients, COUNTRY_CODES } from "./outreach";

describe("normalizePhone", () => {
  it("prepends the default dialing code to a local number", () => {
    expect(normalizePhone("07701234567", "964")).toBe("+9647701234567");
  });

  it("strips a leading trunk zero before prepending", () => {
    expect(normalizePhone("0555 123 456", "966")).toBe("+966555123456");
  });

  it("keeps an already-international number", () => {
    expect(normalizePhone("+20 100 200 3000", "964")).toBe("+201002003000");
  });

  it("converts a 00 prefix to +", () => {
    expect(normalizePhone("0044 7911 123456", "964")).toBe("+447911123456");
  });

  it("rejects too-short or empty input", () => {
    expect(normalizePhone("123", "964")).toBeNull();
    expect(normalizePhone("", "964")).toBeNull();
    expect(normalizePhone("abc", "964")).toBeNull();
  });
});

describe("parseRecipients", () => {
  it("splits on newlines/commas/spaces and normalizes phones", () => {
    const res = parseRecipients("07701234567, 07709999999\n+201002003000", "whatsapp", "964");
    expect(res.valid).toEqual(["+9647701234567", "+9647709999999", "+201002003000"]);
    expect(res.invalid).toEqual([]);
  });

  it("dedupes numbers that normalize to the same value", () => {
    const res = parseRecipients("07701234567\n7701234567\n+9647701234567", "sms", "964");
    expect(res.valid).toEqual(["+9647701234567"]);
  });

  it("separates invalid entries", () => {
    const res = parseRecipients("07701234567\nnot-a-number\n12", "whatsapp", "964");
    expect(res.valid).toEqual(["+9647701234567"]);
    expect(res.invalid).toEqual(["not-a-number", "12"]);
  });

  it("validates emails for the email channel", () => {
    const res = parseRecipients("a@x.com, bad@, B@X.com\nb@x.com", "email", "964");
    expect(res.valid).toEqual(["a@x.com", "b@x.com"]);
    expect(res.invalid).toEqual(["bad@"]);
  });
});

describe("COUNTRY_CODES", () => {
  it("has Iraq first and unique codes+labels", () => {
    expect(COUNTRY_CODES[0].code).toBe("964");
    expect(new Set(COUNTRY_CODES.map((c) => c.code + c.label)).size).toBe(COUNTRY_CODES.length);
  });
});
