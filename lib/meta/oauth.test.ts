import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, tokenKeys } from "./oauth";

const TOKEN_KEY = "a".repeat(64);
const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe("token encryption", () => {
  it("round-trips with only the service role key configured", () => {
    const e = env({ SUPABASE_SERVICE_ROLE_KEY: "srk" });
    expect(decryptToken(encryptToken("twilio-secret", e), e)).toBe("twilio-secret");
  });

  it("refuses to encrypt when no key is configured (no baked-in fallback)", () => {
    expect(tokenKeys(env({}))).toHaveLength(0);
    expect(() => encryptToken("x", env({}))).toThrow(/META_TOKEN_KEY/);
  });

  it("still decrypts older values after META_TOKEN_KEY is added", () => {
    const before = env({ SUPABASE_SERVICE_ROLE_KEY: "srk" });
    const stored = encryptToken("resend-key", before);
    const after = env({ SUPABASE_SERVICE_ROLE_KEY: "srk", META_TOKEN_KEY: TOKEN_KEY });
    expect(decryptToken(stored, after)).toBe("resend-key");
  });

  it("encrypts new values with META_TOKEN_KEY when it is set", () => {
    const both = env({ SUPABASE_SERVICE_ROLE_KEY: "srk", META_TOKEN_KEY: TOKEN_KEY });
    const stored = encryptToken("wa-token", both);
    expect(decryptToken(stored, env({ META_TOKEN_KEY: TOKEN_KEY }))).toBe("wa-token");
  });

  it("decrypts legacy values encrypted with the META_APP_SECRET derivation", () => {
    const stored = encryptToken("ig-token", env({ META_APP_SECRET: "app-secret" }));
    const now = env({ SUPABASE_SERVICE_ROLE_KEY: "srk", META_APP_SECRET: "app-secret" });
    expect(decryptToken(stored, now)).toBe("ig-token");
  });

  it("rejects a value encrypted under a different key", () => {
    const stored = encryptToken("secret", env({ SUPABASE_SERVICE_ROLE_KEY: "one" }));
    expect(() => decryptToken(stored, env({ SUPABASE_SERVICE_ROLE_KEY: "two" }))).toThrow();
  });
});
