import { leads } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { promoteNewLeadToContacted } from "./promoteNewLead.js";

export async function touchLeadContact(leadId: string, contactedAt = new Date()) {
  await db
    .update(leads)
    .set({
      lastContactedAt: contactedAt,
      coldSince: null,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId)));

  await promoteNewLeadToContacted(leadId, {
    reason: "contact_touch",
    at: contactedAt,
  });
}
