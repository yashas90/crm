import { leadActivities } from "@propninja/db";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

export async function recordReEnquiryActivity(input: {
  leadId: string;
  actingUserId: string | null;
  source: string;
  fromStatus?: string;
  toStatus?: string;
}) {
  await db.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId: input.leadId,
    userId: input.actingUserId,
    type: "status_change",
    metadata: {
      kind: "re_enquiry",
      source: input.source,
      ...(input.fromStatus && input.toStatus ? { from: input.fromStatus, to: input.toStatus } : {}),
    },
  });
}
