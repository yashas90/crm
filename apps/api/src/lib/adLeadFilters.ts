import { leads } from "@propninja/db";
import { or, sql } from "drizzle-orm";
import { AD_LEAD_SOURCE_LABELS, AD_LEAD_TAG } from "./adLeadSources.js";
import { leadSourceLowerVariants } from "./leadSourceAliases.js";

/** SQL filter: Facebook/Google ad sources or leads tagged ad_lead (case-insensitive). */
export function adLeadsOnlyFilter() {
  const lowerVariants = [
    ...new Set(AD_LEAD_SOURCE_LABELS.flatMap((label) => leadSourceLowerVariants(label))),
  ];
  return or(
    sql`lower(${leads.leadSource}) in (${sql.join(
      lowerVariants.map((v) => sql`${v}`),
      sql`, `,
    )})`,
    sql`${AD_LEAD_TAG} = ANY(COALESCE(${leads.tags}, ARRAY[]::text[]))`,
  )!;
}
