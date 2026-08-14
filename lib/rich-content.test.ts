import { describe, it, expect } from "vitest";
import { parseRichContent, buildButtonsContent } from "./rich-content";

describe("parseRichContent", () => {
  it("keeps valid buttons and drops invalid ones", () => {
    const rc = parseRichContent({
      type: "buttons",
      buttons: [
        { label: "Buy", url: "https://shop.example/x" },
        { label: "No url" },
        { label: "Bad", url: "javascript:alert(1)" },
      ],
    });
    expect(rc).toEqual({
      type: "buttons",
      buttons: [{ label: "Buy", url: "https://shop.example/x" }],
    });
  });

  it("caps buttons at 3", () => {
    const rc = parseRichContent({
      type: "buttons",
      buttons: Array.from({ length: 5 }, (_, i) => ({
        label: `B${i}`,
        url: `https://x.example/${i}`,
      })),
    });
    expect(rc?.type).toBe("buttons");
    if (rc?.type === "buttons") expect(rc.buttons).toHaveLength(3);
  });

  it("parses cards with a required title", () => {
    const rc = parseRichContent({
      type: "cards",
      cards: [
        { title: "Product", imageUrl: "https://img.example/p.png", buttons: [] },
        { subtitle: "no title" },
      ],
    });
    expect(rc?.type).toBe("cards");
    if (rc?.type === "cards") {
      expect(rc.cards).toHaveLength(1);
      expect(rc.cards[0].title).toBe("Product");
    }
  });

  it("returns null for junk or empty", () => {
    expect(parseRichContent(null)).toBeNull();
    expect(parseRichContent({ type: "buttons", buttons: [] })).toBeNull();
    expect(parseRichContent({ type: "other" })).toBeNull();
  });
});

describe("buildButtonsContent", () => {
  it("returns null when no valid buttons", () => {
    expect(buildButtonsContent([{ label: "x", url: "not-a-url" }])).toBeNull();
  });
});
