import { describe, it, expect } from "vitest";
import { agentStats } from "./agent-stats";

const members = [
  { id: "a", email: "ana@x.com" },
  { id: "b", email: "bob@x.com" },
];

describe("agentStats", () => {
  it("counts assigned / open / resolved per agent", () => {
    const stats = agentStats(
      members,
      [
        { assigned_to: "a", status: "open" },
        { assigned_to: "a", status: "closed" },
        { assigned_to: "b", status: "open" },
        { assigned_to: null, status: "open" },
      ],
      [],
      []
    );
    const a = stats.find((s) => s.id === "a")!;
    expect(a).toMatchObject({ assigned: 2, open: 1, resolved: 1 });
    expect(stats.find((s) => s.id === "b")!.assigned).toBe(1);
  });

  it("counts replies by author", () => {
    const stats = agentStats(
      members,
      [],
      [{ sent_by_user_id: "a" }, { sent_by_user_id: "a" }, { sent_by_user_id: null }],
      []
    );
    expect(stats.find((s) => s.id === "a")!.replies).toBe(2);
  });

  it("averages CSAT per agent and ignores out-of-range ratings", () => {
    const stats = agentStats(
      members,
      [],
      [],
      [
        { agentId: "a", rating: 5 },
        { agentId: "a", rating: 4 },
        { agentId: "a", rating: 9 },
        { agentId: "b", rating: null },
      ]
    );
    const a = stats.find((s) => s.id === "a")!;
    expect(a.csatResponses).toBe(2);
    expect(a.csatAvg).toBe(4.5);
    expect(stats.find((s) => s.id === "b")!.csatAvg).toBeNull();
  });

  it("sorts busiest first", () => {
    const stats = agentStats(
      members,
      [
        { assigned_to: "b", status: "open" },
        { assigned_to: "b", status: "open" },
        { assigned_to: "a", status: "open" },
      ],
      [],
      []
    );
    expect(stats[0].id).toBe("b");
  });
});
