import { assignmentRuleState, leadAssignmentRules } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const assignmentRulesRoutes = new Hono();

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  strategy: z.enum(["round_robin", "by_source", "by_area"]).default("round_robin"),
  conditions: z
    .object({
      sources: z.array(z.string()).optional(),
      cities: z.array(z.string()).optional(),
      zones: z.array(z.string()).optional(),
    })
    .default({}),
  assigneeIds: z.array(z.string().uuid()).min(1, "At least one assignee required"),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

assignmentRulesRoutes.get("/", async (c) => {
  const db = c.get("db");
  const rules = await db
    .select()
    .from(leadAssignmentRules)
    .where(eq(leadAssignmentRules.orgId, SINGLE_TENANT_ORG_ID));
  return c.json({ ok: true, data: rules });
});

assignmentRulesRoutes.post("/", writeRateLimit, validate("json", ruleSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "Only admins and managers can create rules" },
      },
      403,
    );
  }
  const db = c.get("db");
  const body = c.req.valid("json");

  const [rule] = await db
    .insert(leadAssignmentRules)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      name: body.name,
      strategy: body.strategy,
      conditions: body.conditions,
      assigneeIds: body.assigneeIds,
      priority: body.priority,
      isActive: body.isActive,
      createdBy: authUser.id,
    })
    .returning();

  await db.insert(assignmentRuleState).values({ ruleId: rule.id }).onConflictDoNothing();

  return c.json({ ok: true, data: rule }, 201);
});

assignmentRulesRoutes.patch("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "Only admins and managers can update rules" },
      },
      403,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id")!;
  const body = await c.req.json();
  const parsed = ruleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, 400);
  }

  const [rule] = await db
    .update(leadAssignmentRules)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.orgId, SINGLE_TENANT_ORG_ID)))
    .returning();

  if (!rule)
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Rule not found" } }, 404);
  return c.json({ ok: true, data: rule });
});

assignmentRulesRoutes.delete("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Only admins can delete rules" } },
      403,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id")!;
  await db
    .delete(leadAssignmentRules)
    .where(
      and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.orgId, SINGLE_TENANT_ORG_ID)),
    );
  return c.json({ ok: true, data: { id } });
});

/** Called internally by lead creation to auto-assign based on active rules. */
export async function autoAssignLead(
  db: ReturnType<typeof import("../lib/db.js").getDb>,
  lead: { leadSource?: string | null; city?: string | null; zone?: string | null },
): Promise<string | null> {
  const rules = await db
    .select()
    .from(leadAssignmentRules)
    .where(
      and(
        eq(leadAssignmentRules.orgId, SINGLE_TENANT_ORG_ID),
        eq(leadAssignmentRules.isActive, true),
      ),
    )
    .orderBy(leadAssignmentRules.priority);

  for (const rule of rules) {
    const cond = rule.conditions as { sources?: string[]; cities?: string[]; zones?: string[] };
    const sourceMatch =
      !cond.sources?.length || (!!lead.leadSource && cond.sources.includes(lead.leadSource));
    const cityMatch = !cond.cities?.length || (!!lead.city && cond.cities.includes(lead.city));
    const zoneMatch = !cond.zones?.length || (!!lead.zone && cond.zones.includes(lead.zone));

    if (!sourceMatch || !cityMatch || !zoneMatch) continue;

    const assignees = rule.assigneeIds;
    if (!assignees.length) continue;

    if (rule.strategy === "round_robin") {
      const [state] = await db
        .select()
        .from(assignmentRuleState)
        .where(eq(assignmentRuleState.ruleId, rule.id));

      const idx = state ? (state.lastAssignedIndex + 1) % assignees.length : 0;

      await db
        .insert(assignmentRuleState)
        .values({ ruleId: rule.id, lastAssignedIndex: idx })
        .onConflictDoUpdate({
          target: assignmentRuleState.ruleId,
          set: { lastAssignedIndex: idx, updatedAt: new Date() },
        });

      return assignees[idx] ?? null;
    }

    return assignees[0] ?? null;
  }

  return null;
}
