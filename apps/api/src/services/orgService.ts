import { organizations } from "@propninja/db";
import { eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { notFound } from "../lib/errors.js";

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
  };
}

export type OrgService = ReturnType<typeof createOrgService>;
