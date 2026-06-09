import { leads } from "@propninja/db";
import { inArray, or, sql } from "drizzle-orm";
import { AD_LEAD_SOURCE_LABELS, AD_LEAD_TAG } from "./adLeadSources.js";

/** SQL filter: Facebook/Google ad sources or leads tagged ad_lead. */
export function adLeadsOnlyFilter() {
  return or(
    inArray(leads.leadSource, [...AD_LEAD_SOURCE_LABELS]),
    sql`'${AD_LEAD_TAG}' = ANY(COALESCE(${leads.tags}, ARRAY[]::text[]))`,
  )!;
}
