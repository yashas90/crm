import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_LEADERBOARD_KEYS,
  type LeaderboardDeal,
  type LeaderboardPerson,
  NR_BADGE_RUPEES,
  assembleLeaderboard,
  collectKeys,
  evaluateBadgeAwards,
} from "./leaderboardRank.js";

const NOW = new Date("2026-10-14T06:30:00.000Z");

function person(
  partial: Partial<LeaderboardPerson> & Pick<LeaderboardPerson, "userId" | "name">,
): LeaderboardPerson {
  return {
    role: "agent",
    designation: "Executive",
    band: "NE",
    monthlyBasic: 123_456,
    reportingToId: null,
    department: "Sales",
    showLeaderboardAvatar: false,
    ...partial,
  };
}

function deal(
  partial: Partial<LeaderboardDeal> & Pick<LeaderboardDeal, "id" | "netRevenue" | "shares">,
): LeaderboardDeal {
  return {
    status: "approved",
    invoiceStatus: "collected",
    closedOn: "2026-10-02",
    ...partial,
  };
}

const priya = person({
  userId: "priya",
  name: "Priya Shah",
  role: "manager",
  band: "N2",
  designation: "Manager",
});
const amit = person({ userId: "amit", name: "Amit Shah", reportingToId: "priya" });
const rahul = person({
  userId: "rahul",
  name: "Rahul Mehta",
  role: "manager",
  band: "N2",
  designation: "Manager",
  department: "West",
});
const neha = person({
  userId: "neha",
  name: "Neha Kapoor",
  reportingToId: "rahul",
  department: "West",
});
const n3 = person({
  userId: "n3",
  name: "Nila Rao",
  role: "manager",
  band: "N3",
  designation: "Head",
});

function board(
  people: LeaderboardPerson[],
  deals: LeaderboardDeal[],
  viewer: LeaderboardPerson,
  scope: "team" | "all" | "branch" = "all",
) {
  return assembleLeaderboard({
    people,
    deals,
    snapshots: [],
    announcements: [],
    viewerId: viewer.userId,
    viewerRole: viewer.role,
    query: { period: "month", scope },
    now: NOW,
  });
}

describe("leaderboard ranking", () => {
  const people = [
    person({ userId: "a", name: "A" }),
    person({ userId: "b", name: "B" }),
    person({ userId: "d", name: "D" }),
    person({ userId: "c", name: "C" }),
  ];

  const deals: LeaderboardDeal[] = [
    deal({
      id: "a1",
      netRevenue: 500_000,
      closedOn: "2026-10-01",
      shares: [{ userId: "a", sharePercent: 100 }],
    }),
    deal({
      id: "b1",
      netRevenue: 500_000,
      closedOn: "2026-10-10",
      shares: [{ userId: "b", sharePercent: 100 }],
    }),
    deal({
      id: "d1",
      netRevenue: 250_000,
      closedOn: "2026-10-05",
      shares: [{ userId: "d", sharePercent: 100 }],
    }),
    deal({
      id: "d2",
      netRevenue: 250_000,
      closedOn: "2026-10-06",
      shares: [{ userId: "d", sharePercent: 100 }],
    }),
    deal({
      id: "c1",
      netRevenue: 200_000,
      closedOn: "2026-10-03",
      shares: [{ userId: "c", sharePercent: 100 }],
    }),
    deal({
      id: "raised",
      netRevenue: 9_000_000,
      invoiceStatus: "raised",
      shares: [{ userId: "c", sharePercent: 100 }],
    }),
    deal({
      id: "draft",
      netRevenue: 8_000_000,
      status: "draft",
      invoiceStatus: "collected",
      shares: [{ userId: "a", sharePercent: 100 }],
    }),
    deal({
      id: "half",
      netRevenue: 200_000,
      closedOn: "2026-10-04",
      shares: [{ userId: "c", sharePercent: 50 }],
    }),
  ];

  it("orders by NR, then deals, then earliest collected deal, and skips uncollected", () => {
    const payload = board(people, deals, { ...people[0]!, role: "admin" }, "all");
    expect(payload.entries.map((row) => row.agentName)).toEqual(["D", "A", "B", "C"]);
    const c = payload.entries.find((row) => row.agentName === "C");
    expect(c?.totalNr).toBe(300_000);
    expect(c?.dealsClosed).toBe(2);
    expect(c?.unitsClosed).toBe(1.5);
    expect(payload.entries.find((row) => row.agentName === "A")?.totalNr).toBe(500_000);
  });

  it("marks an improved rank against yesterday's snapshot", () => {
    const payload = assembleLeaderboard({
      people,
      deals,
      snapshots: [
        {
          userId: "a",
          periodKey: "month:2026-10",
          scopeKey: "all",
          rank: 5,
          snapshotDate: "2026-10-13",
        },
      ],
      announcements: [],
      viewerId: "a",
      viewerRole: "agent",
      query: { period: "month", scope: "all" },
      now: NOW,
    });
    const row = payload.entries.find((entry) => entry.agentName === "A");
    expect(row?.trend).toBe("up");
    expect(row?.trendDelta).toBe(3);
    expect(row?.previousRank).toBe(5);
  });
});

describe("leaderboard privacy", () => {
  const people = [priya, amit, rahul, neha, n3];
  const deals = [
    deal({ id: "1", netRevenue: 1_000, shares: [{ userId: "amit", sharePercent: 100 }] }),
    deal({ id: "2", netRevenue: 2_000, shares: [{ userId: "neha", sharePercent: 100 }] }),
  ];

  it("masks other teams for an agent and keeps the home team", () => {
    const payload = board(people, deals, amit, "all");
    const text = JSON.stringify(payload);
    expect(text).toContain("Amit Shah");
    expect(text).toContain("Agent from Rahul Mehta's team");
    expect(text).not.toContain("Neha Kapoor");
    expect(payload.me.agentName).toBe("Amit Shah");
    expect(payload.me.userId).toBe("amit");
    const masked = payload.entries.find((row) => row.masked);
    expect(masked?.designation).toBeNull();
    expect(masked?.avatarUrl).toBeNull();
    expect(masked?.userId).toBeNull();
  });

  it("hides other teams' names from a manager who is not N3", () => {
    const payload = board(people, deals, rahul, "all");
    const text = JSON.stringify(payload);
    expect(text).toContain("Neha Kapoor");
    expect(text).not.toContain("Amit Shah");
    expect(text).not.toContain("Priya Shah");
  });

  it("shows every name to an N3 manager and an admin", () => {
    expect(JSON.stringify(board(people, deals, n3, "all"))).toContain("Amit Shah");
    const admin = person({ userId: "admin", name: "Ada Admin", role: "admin", band: null });
    expect(JSON.stringify(board([...people, admin], deals, admin, "all"))).toContain("Neha Kapoor");
  });

  it("omits salary and individual target rupees", () => {
    const payload = board(people, deals, amit, "all");
    const keys = collectKeys(payload);
    for (const key of FORBIDDEN_LEADERBOARD_KEYS) {
      expect(keys.has(key)).toBe(false);
    }
    expect(keys.has("target")).toBe(false);
    const text = JSON.stringify(payload);
    expect(text).not.toContain("monthlyBasic");
    expect(text).not.toContain("123456");
    expect(text).not.toContain("617280");
  });
});

describe("leaderboard badges", () => {
  const agent = person({ userId: "agent", name: "Agent", monthlyBasic: 100_000, band: "NE" });

  function awardsFor(deals: LeaderboardDeal[]) {
    return evaluateBadgeAwards([agent], deals, NOW).filter((award) => award.agentId === "agent");
  }

  function types(deals: LeaderboardDeal[]) {
    return new Set(awardsFor(deals).map((award) => award.type));
  }

  it("awards deal-count, target, NR, and top-gun badges at the published rupee lines", () => {
    expect(NR_BADGE_RUPEES.nr_50l).toBe(5_000_000);
    const five = Array.from({ length: 5 }, (_, index) =>
      deal({
        id: `f${index}`,
        netRevenue: 1,
        closedOn: `2026-10-${String(index + 1).padStart(2, "0")}`,
        shares: [{ userId: "agent", sharePercent: 100 }],
      }),
    );
    expect(types(five).has("five_deals")).toBe(true);
    expect(types(five).has("ten_deals")).toBe(false);
    expect(types(five).has("first_deal")).toBe(true);
    expect(types(five).has("top_gun")).toBe(true);

    const ten = Array.from({ length: 10 }, (_, index) =>
      deal({
        id: `t${index}`,
        netRevenue: 1,
        closedOn: "2026-10-02",
        shares: [{ userId: "agent", sharePercent: 100 }],
      }),
    );
    expect(types(ten).has("ten_deals")).toBe(true);

    expect(
      types([
        deal({ id: "hit", netRevenue: 500_000, shares: [{ userId: "agent", sharePercent: 100 }] }),
      ]).has("target_hit"),
    ).toBe(true);
    expect(
      types([
        deal({ id: "over", netRevenue: 750_000, shares: [{ userId: "agent", sharePercent: 100 }] }),
      ]).has("overachiever"),
    ).toBe(true);
    expect(
      types([
        deal({
          id: "l10",
          netRevenue: NR_BADGE_RUPEES.nr_10l,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ]).has("nr_10l"),
    ).toBe(true);
    expect(
      types([
        deal({
          id: "l25",
          netRevenue: NR_BADGE_RUPEES.nr_25l,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ]).has("nr_25l"),
    ).toBe(true);
    expect(
      types([
        deal({
          id: "almost",
          netRevenue: NR_BADGE_RUPEES.nr_50l - 1,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ]).has("nr_50l"),
    ).toBe(false);
    expect(
      types([
        deal({
          id: "l50",
          netRevenue: NR_BADGE_RUPEES.nr_50l,
          shares: [{ userId: "agent", sharePercent: 100 }],
        }),
      ]).has("nr_50l"),
    ).toBe(true);
  });

  it("awards streak badges for consecutive IST days and not a 7-day badge for three days", () => {
    const deals = ["2026-10-01", "2026-10-02", "2026-10-03"].map((closedOn, index) =>
      deal({
        id: `s${index}`,
        netRevenue: 10,
        closedOn,
        shares: [{ userId: "agent", sharePercent: 100 }],
      }),
    );
    const earned = types(deals);
    expect(earned.has("streak_3")).toBe(true);
    expect(earned.has("streak_7")).toBe(false);
  });

  it("does not give top gun to second place", () => {
    const other = person({ userId: "other", name: "Other" });
    const earned = evaluateBadgeAwards(
      [agent, other],
      [
        deal({ id: "win", netRevenue: 10, shares: [{ userId: "other", sharePercent: 100 }] }),
        deal({ id: "lose", netRevenue: 1, shares: [{ userId: "agent", sharePercent: 100 }] }),
      ],
      NOW,
    );
    const guns = earned.filter((award) => award.type === "top_gun");
    expect(guns.map((award) => award.agentId)).toEqual(["other"]);
  });
});
