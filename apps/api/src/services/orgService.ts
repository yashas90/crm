import { organizations } from "@propninja/db";
import { eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { buildOrgSettingsPatch, mergeOrgSettings } from "../lib/orgSettings.js";
import { clearOrgCache } from "../lib/responseCache.js";
import type { UpdateOrgBody } from "../lib/validators/org.js";

export function createOrgService(db: Database) {
  return {
    async get() {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
        .limit(1);

      if (!row) {
        throw notFound("Organization not found");
      }

      return row;
    },

    async update(body: UpdateOrgBody) {
      const [existing] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
        .limit(1);

      if (!existing) {
        throw notFound("Organization not found");
      }

      const update: Partial<typeof organizations.$inferInsert> = {};
      if (body.name !== undefined) {
        update.name = body.name;
      }

      const settingsPatch = buildOrgSettingsPatch(body);
      if (Object.keys(settingsPatch).length > 0) {
        update.settings = mergeOrgSettings(existing.settings, settingsPatch);
      }

      if (Object.keys(update).length === 0) {
        return existing;
      }

      const [row] = await db
        .update(organizations)
        .set(update)
        .where(eq(organizations.id, SINGLE_TENANT_ORG_ID))
        .returning();

      if (!row) {
        throw notFound("Organization not found");
      }

      clearOrgCache();
      return row;
    },
  };
}

export type OrgService = ReturnType<typeof createOrgService>;
