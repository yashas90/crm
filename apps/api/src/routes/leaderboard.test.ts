import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORBIDDEN_LEADERBOARD_KEYS, collectKeys } from "../lib/leaderboardRank.js";
import { errorHandler } from "../middleware/errorHandler.js";

const AGENT = {
  id: "amit",
  role: "agent" as const,
  email: "amit@test.com",
  name: "Amit Shah",
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const NOW = new Date("2026-10-14T06:30:00.000Z");

vi.mock("../services/leaderboardService.js", async () => {
  const { assembleLeaderboard } = await import("../lib/leaderboardRank.js");
  return {
    createLeaderboardService: () => ({
      board: async (user: { id: string; role: "admin" | "manager" | "agent" }) =>
        assembleLeaderboard({
          people: [
            {
              userId: "amit",
              name: "Amit Shah",
              role: "agent",
              designation: "Executive",
              band: "NE",
              monthlyBasic: 123_456,
              reportingToId: "priya",
              department: "Sales",
              showLeaderboardAvatar: false,
            },
          ],
          deals: [
            {
              id: "collected",
              status: "approved",
              invoiceStatus: "collected",
              netRevenue: 500_000,
              closedOn: "2026-10-02",
              shares: [{ userId: "amit", sharePercent: 100 }],
            },
            {
              id: "raised",
              status: "approved",
              invoiceStatus: "raised",
              netRevenue: 9_000_000,
              closedOn: "2026-10-03",
              shares: [{ userId: "amit", sharePercent: 100 }],
            },
            {
              id: "draft",
              status: "draft",
              invoiceStatus: "collected",
              netRevenue: 8_000_000,
              closedOn: "2026-10-04",
              shares: [{ userId: "amit", sharePercent: 100 }],
            },
          ],
          snapshots: [],
          announcements: [],
          viewerId: user.id,
          viewerRole: user.role,
          query: { period: "month", scope: "team" },
          now: NOW,
        }),
    }),
  };
});

async function makeApp() {
  const { leaderboardRoutes } = await import("./leaderboard.js");
  const app = new Hono();
  app.onError(errorHandler);
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("authUser", AGENT);
    await next();
  });
  app.route("/api/leaderboard", leaderboardRoutes);
  return app;
}

describe("GET /api/leaderboard", () => {
  let app: Hono;

  beforeEach(async () => {
    app = await makeApp();
  });

  it("excludes deals that are not approved and collected, and hides salary and target rupees", async () => {
    const res = await app.request("/api/leaderboard?period=month&scope=team");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { me: { totalNr: number } } };
    expect(body.ok).toBe(true);
    expect(body.data.me.totalNr).toBe(500_000);
    const keys = collectKeys(body);
    for (const key of FORBIDDEN_LEADERBOARD_KEYS) {
      expect(keys.has(key)).toBe(false);
    }
    expect(keys.has("target")).toBe(false);
    const text = JSON.stringify(body);
    expect(text).not.toContain("monthlyBasic");
    expect(text).not.toContain("eligibilityTarget");
    expect(text).not.toContain("123456");
    expect(text).not.toContain("617280");
    expect(text).not.toContain("9000000");
    expect(text).not.toContain("8000000");
  });

  it("returns 403 when a non-admin exports", async () => {
    const res = await app.request("/api/leaderboard/export?format=xls");
    expect(res.status).toBe(403);
  });
});
