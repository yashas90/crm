import { pipelineStages } from "@propninja/db";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const pipelineStagesRoutes = new Hono();

const stageSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  position: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  mapsToStatus: z.string().nullable().optional(),
});

pipelineStagesRoutes.get("/", async (c) => {
  const db = c.get("db");
  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(asc(pipelineStages.position));
  return c.json({ ok: true, data: stages });
});

pipelineStagesRoutes.post("/", writeRateLimit, validate("json", stageSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: "Admins only" } }, 403);
  }
  const db = c.get("db");
  const body = c.req.valid("json");
  const [stage] = await db
    .insert(pipelineStages)
    .values({ orgId: SINGLE_TENANT_ORG_ID, ...body })
    .returning();
  return c.json({ ok: true, data: stage }, 201);
});

pipelineStagesRoutes.patch("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: "Admins only" } }, 403);
  }
  const db = c.get("db");
  const id = c.req.param("id")!;
  const body = await c.req.json();
  const parsed = stageSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, 400);
  }
  const [stage] = await db
    .update(pipelineStages)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.orgId, SINGLE_TENANT_ORG_ID)))
    .returning();
  if (!stage) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Stage not found" } }, 404);
  }
  return c.json({ ok: true, data: stage });
});

/** Bulk reorder: body = { stages: [{id, position}] } */
pipelineStagesRoutes.put("/reorder", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: "Admins only" } }, 403);
  }
  const db = c.get("db");
  const { stages } = (await c.req.json()) as { stages: { id: string; position: number }[] };
  if (!Array.isArray(stages)) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "stages array required" } },
      400,
    );
  }
  await Promise.all(
    stages.map(({ id, position }) =>
      db
        .update(pipelineStages)
        .set({ position, updatedAt: new Date() })
        .where(and(eq(pipelineStages.id, id), eq(pipelineStages.orgId, SINGLE_TENANT_ORG_ID))),
    ),
  );
  return c.json({ ok: true, data: { reordered: stages.length } });
});

pipelineStagesRoutes.delete("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role !== "admin") {
    return c.json({ ok: false, error: { code: "FORBIDDEN", message: "Admins only" } }, 403);
  }
  const db = c.get("db");
  const id = c.req.param("id")!;
  await db
    .delete(pipelineStages)
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.orgId, SINGLE_TENANT_ORG_ID)));
  return c.json({ ok: true, data: { id } });
});
