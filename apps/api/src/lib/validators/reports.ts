import { LEAD_STATUSES } from "@propninja/types/enums";
import { z } from "zod";

const MS_PER_DAY = 86_400_000;
const leadStatusSchema = z.enum(LEAD_STATUSES);

function defaultDateRange(dateFrom?: string, dateTo?: string) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 7 * MS_PER_DAY);
  return { dateFrom: from, dateTo: to };
}

function defaultDashboardDateRange(dateFrom?: string, dateTo?: string) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 29 * MS_PER_DAY);
  return { dateFrom: from, dateTo: to };
}

const uuidListSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value?.trim()) return undefined;
    const ids = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  })
  .pipe(z.array(z.string().uuid()).optional());

const adLeadsQueryField = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const reportFilterFieldsSchema = z.object({
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  user_id: z.string().uuid().optional(),
  status: leadStatusSchema.optional(),
  ad_leads: adLeadsQueryField,
});

export const dashboardReportQuerySchema = z
  .object({
    date_from: z.string().datetime({ offset: true }).optional(),
    date_to: z.string().datetime({ offset: true }).optional(),
    user_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    ...defaultDateRange(value.date_from, value.date_to),
    userId: value.user_id,
  }));

export const overviewReportQuerySchema = reportFilterFieldsSchema.transform((value) => ({
  ...defaultDashboardDateRange(value.date_from, value.date_to),
  userId: value.user_id,
  status: value.status,
  adLeadsOnly: value.ad_leads,
}));

export const leadsReportQuerySchema = reportFilterFieldsSchema
  .extend({
    source: z.string().trim().optional(),
    lead_source: z.string().trim().optional(),
  })
  .transform((value) => ({
    ...defaultDashboardDateRange(value.date_from, value.date_to),
    userId: value.user_id,
    status: value.status,
    adLeadsOnly: value.ad_leads,
    source: value.ad_leads ? undefined : (value.source ?? value.lead_source),
  }));

export const sourcesReportQuerySchema = overviewReportQuerySchema;

export const callsReportQuerySchema = reportFilterFieldsSchema
  .extend({
    group_by: z.enum(["user"]).optional(),
    user_status: z.enum(["all", "active", "inactive"]).optional(),
    user_name: z.string().trim().optional(),
    user_ids: uuidListSchema,
    source: z.string().trim().optional(),
    sub_source: z.string().trim().optional(),
    project_name: z.string().trim().optional(),
    project_status: z.enum(["active", "inactive"]).optional(),
    campaign_name: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(100).optional(),
  })
  .transform((value) => ({
    ...defaultDashboardDateRange(value.date_from, value.date_to),
    userId: value.user_id,
    userIds: value.user_ids,
    status: value.status,
    groupBy: value.group_by,
    userStatus: value.user_status ?? "all",
    userName: value.user_name,
    source: value.source,
    subSource: value.sub_source,
    projectName: value.project_name,
    projectStatus: value.project_status,
    campaignName: value.campaign_name,
    page: value.page ?? 1,
    pageSize: value.page_size ?? 50,
  }));

export type DashboardReportQuery = z.infer<typeof dashboardReportQuerySchema>;
export type OverviewReportQuery = z.infer<typeof overviewReportQuerySchema>;
export type LeadsReportQuery = z.infer<typeof leadsReportQuerySchema>;
export type SourcesReportQuery = z.infer<typeof sourcesReportQuerySchema>;
export type CallsReportQuery = z.infer<typeof callsReportQuerySchema>;
