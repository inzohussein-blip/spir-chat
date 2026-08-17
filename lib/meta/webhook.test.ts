import { describe, it, expect } from "vitest";
import { extractComments } from "./webhook";

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
