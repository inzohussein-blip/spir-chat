import { describe, it, expect } from "vitest";
import { csatStats, buildCsatUrl, csatMessage, type CsatResponse } from "./csat";

describe("csatStats", () => {
  it("handles no surveys", () => {
    const s = csatStats([]);
    expect(s).toMatchObject({
      responses: 0,
      sent: 0,
      average: null,
      satisfactionScore: null,
      responseRate: null,
    });
  });

  it("ignores pending (unrated) surveys in averages but counts them as sent", () => {
    const rows: CsatResponse[] = [
      { rating: 5, status: "responded" },
      { rating: null, status: "pending" },
      { rating: null, status: "pending" },
    ];
    const s = csatStats(rows);
    expect(s.sent).toBe(3);
    expect(s.responses).toBe(1);
    expect(s.average).toBe(5);
    expect(s.responseRate).toBe(33);
  });

  it("computes CSAT score as percentage of 4-5 ratings", () => {
    const rows: CsatResponse[] = [
      { rating: 5, status: "responded" },
      { rating: 4, status: "responded" },
      { rating: 3, status: "responded" },
      { rating: 1, status: "responded" },
    ];
    const s = csatStats(rows);
    expect(s.responses).toBe(4);
    expect(s.average).toBe(3.3); // (5+4+3+1)/4 = 3.25 -> 3.3
    expect(s.satisfactionScore).toBe(50); // 2 of 4 are >= 4
    expect(s.responseRate).toBe(100);
    expect(s.distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1, 5: 1 });
  });

  it("clamps out-of-range ratings out of the aggregate", () => {
    const rows: CsatResponse[] = [
      { rating: 0, status: "responded" },
      { rating: 6, status: "responded" },
      { rating: 4, status: "responded" },
    ];
    const s = csatStats(rows);
    expect(s.responses).toBe(1);
    expect(s.average).toBe(4);
  });
});

describe("buildCsatUrl / csatMessage", () => {
  it("builds a public url from a token", () => {
    expect(buildCsatUrl("abc", "https://x.com/")).toBe("https://x.com/csat/abc");
  });
  it("embeds the url in the message", () => {
    expect(csatMessage("https://x.com/csat/abc")).toContain("https://x.com/csat/abc");
  });
});
