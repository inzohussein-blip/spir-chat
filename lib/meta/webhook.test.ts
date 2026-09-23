import { createHmac } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import { extractComments, verifyWebhookSignature } from "./webhook";

describe("extractComments", () => {
  it("pulls comment changes out of a Meta webhook body", () => {
    const body = {
      object: "instagram",
      entry: [
        {
          id: "1784xxxx", // the receiving IG user id
          changes: [
            {
              field: "comments",
              value: {
                id: "comment-1",
                text: "LINK please",
                from: { id: "user-9", username: "sam" },
                media: { id: "media-3" },
              },
            },
          ],
        },
      ],
    };
    expect(extractComments(body)).toEqual([
      {
        igUserId: "1784xxxx",
        commentId: "comment-1",
        postId: "media-3",
        text: "LINK please",
        fromId: "user-9",
        fromUsername: "sam",
      },
    ]);
  });

  it("ignores non-comment changes and malformed bodies", () => {
    expect(extractComments({ entry: [{ id: "x", changes: [{ field: "messages" }] }] })).toEqual([]);
    expect(extractComments(null)).toEqual([]);
    expect(extractComments({})).toEqual([]);
  });
});

describe("verifyWebhookSignature", () => {
  afterEach(() => vi.unstubAllEnvs());
  const body = '{"object":"whatsapp_business_account"}';
  const sign = (secret: string) =>
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("rejects every request when META_APP_SECRET is not set", () => {
    vi.stubEnv("META_APP_SECRET", "");
    expect(verifyWebhookSignature(body, sign("anything"))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("accepts a correct signature and rejects a wrong or missing one", () => {
    vi.stubEnv("META_APP_SECRET", "app-secret");
    expect(verifyWebhookSignature(body, sign("app-secret"))).toBe(true);
    expect(verifyWebhookSignature(body, sign("other"))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });
});
