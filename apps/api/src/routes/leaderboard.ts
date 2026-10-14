import { Hono } from "hono";
import { z } from "zod";
import { forbidden } from "../lib/errors.js";
import type { LeaderboardQuery } from "../lib/leaderboardRank.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { createLeaderboardService } from "../services/leaderboardService.js";

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

const leaderboardQuerySchema = z.object({
  period: z.enum(["month", "quarter", "year", "all"]).optional(),
  scope: z.enum(["team", "all", "branch"]).optional(),
  team_id: z.string().uuid().optional(),
  month: optionalNumber,
  year: optionalNumber,
  quarter: optionalNumber,
  quarterYear: optionalNumber,
});

const exportQuerySchema = leaderboardQuerySchema.extend({
  format: z.enum(["xls", "pdf"]),
});

const announcementSchema = z.object({
  kind: z.enum(["announcement", "challenge"]),
  body: z.string().trim().min(1).max(500),
});

const avatarSchema = z.object({
  show: z.boolean(),
});

function toQuery(raw: z.infer<typeof leaderboardQuerySchema>): LeaderboardQuery {
  return {
    period: raw.period ?? "month",
    scope: raw.scope ?? "team",
    teamId: raw.team_id,
    month: raw.month,
    year: raw.year,
    quarter: raw.quarter,
    quarterYear: raw.quarterYear,
  };
}

export const leaderboardRoutes = new Hono();

leaderboardRoutes.get("/", validate("query", leaderboardQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createLeaderboardService(c.get("db")).board(
    user,
    toQuery(c.req.valid("query")),
  );
  return jsonOk(c, data);
});

leaderboardRoutes.get("/hall-of-fame", validate("query", leaderboardQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createLeaderboardService(c.get("db")).hall(
    user,
    toQuery(c.req.valid("query")),
  );
  return jsonOk(c, data);
});

leaderboardRoutes.get("/teams", validate("query", leaderboardQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createLeaderboardService(c.get("db")).teams(
    user,
    toQuery(c.req.valid("query")),
  );
  return jsonOk(c, data);
});

leaderboardRoutes.get("/announcements", async (c) => {
  const user = c.get("authUser") as AuthUser;
  if (user.role !== "admin")
    return jsonError(c, "FORBIDDEN", "Only an admin can manage banners", 403);
  const data = await createLeaderboardService(c.get("db")).listAnnouncements(user);
  return jsonOk(c, data);
});

leaderboardRoutes.post("/announcements", validate("json", announcementSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  if (user.role !== "admin")
    return jsonError(c, "FORBIDDEN", "Only an admin can pin a banner", 403);
  const data = await createLeaderboardService(c.get("db")).saveAnnouncement(
    user,
    c.req.valid("json"),
  );
  return jsonOk(c, data);
});

leaderboardRoutes.patch("/avatar", validate("json", avatarSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createLeaderboardService(c.get("db")).setAvatar(
    user,
    c.req.valid("json").show,
  );
  return jsonOk(c, data);
});

leaderboardRoutes.get("/export", validate("query", exportQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  if (user.role !== "admin") {
    throw forbidden("Only an admin can export the leaderboard");
  }
  const raw = c.req.valid("query");
  const file = await createLeaderboardService(c.get("db")).exportFile(
    user,
    toQuery(raw),
    raw.format,
  );
  const body = typeof file.body === "string" ? file.body : new Uint8Array(file.body);
  return c.body(body, 200, {
    "Content-Type": file.contentType,
    "Content-Disposition": `attachment; filename="${file.filename}"`,
  });
});
