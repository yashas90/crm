import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  disburseSchema,
  incentiveProfileSchema,
  quarterQuerySchema,
} from "../lib/validators/transactionClosures.js";
import type { AuthUser } from "../middleware/auth.js";
import { createIncentiveService } from "../services/incentiveService.js";

export const incentiveRoutes = new Hono();

incentiveRoutes.get("/slabs", async (c) => {
  return jsonOk(c, createIncentiveService(c.get("db")).slabs());
});

incentiveRoutes.get("/me", validate("query", quarterQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).mine(user, c.req.valid("query").quarter);
  return jsonOk(c, data);
});

incentiveRoutes.get("/team", validate("query", quarterQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).team(user, c.req.valid("query").quarter);
  return jsonOk(c, data);
});

incentiveRoutes.get("/disbursements", validate("query", quarterQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).disbursements(
    user,
    c.req.valid("query").quarter,
  );
  return jsonOk(c, data);
});

incentiveRoutes.post("/disbursements", validate("json", disburseSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const data = await createIncentiveService(c.get("db")).disburse(user, body.userId, body.quarter);
  return jsonOk(c, data);
});

incentiveRoutes.put("/profiles", validate("json", incentiveProfileSchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).saveProfile(user, c.req.valid("json"));
  return jsonOk(c, data);
});

export const appraisalRoutes = new Hono();

appraisalRoutes.get("/policy", async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).appraisal(user);
  return jsonOk(c, { policy: data.policy });
});

appraisalRoutes.get("/me", validate("query", quarterQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const data = await createIncentiveService(c.get("db")).appraisal(
    user,
    c.req.valid("query").quarter,
    false,
  );
  return jsonOk(c, data);
});

appraisalRoutes.get("/", validate("query", quarterQuerySchema), async (c) => {
  const user = c.get("authUser") as AuthUser;
  const everyone = user.role === "admin" || user.role === "manager";
  const data = await createIncentiveService(c.get("db")).appraisal(
    user,
    c.req.valid("query").quarter,
    everyone,
  );
  return jsonOk(c, data);
});
