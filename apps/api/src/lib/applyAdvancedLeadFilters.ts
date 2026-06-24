import { leadAssignments, leads, projects, siteVisits, tasks } from "@propninja/db";
import { type SQL, eq, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { type LeadAdvancedListQuery, TAG_PRESET_FILTER_SQL } from "./leadAdvancedListQuery.js";

export type AdvancedLeadFilterParams = Partial<LeadAdvancedListQuery> & {
  assignedTo?: string;
};

export function applyAdvancedLeadFilters(
  params: AdvancedLeadFilterParams,
  whereClauses: SQL[],
): void {
  if (params.assignedTo && params.assignWithHistory) {
    whereClauses.push(
      or(
        eq(leads.assignedTo, params.assignedTo),
        sql`EXISTS (
          SELECT 1 FROM ${leadAssignments} la
          WHERE la.lead_id = ${leads.id}
            AND la.to_agent_id = ${params.assignedTo}
        )`,
      )!,
    );
  }

  if (params.assignedFrom) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${leadAssignments} la
        WHERE la.lead_id = ${leads.id}
          AND la.from_agent_id = ${params.assignedFrom}
          AND la.assigned_at = (
            SELECT MAX(la2.assigned_at) FROM ${leadAssignments} la2
            WHERE la2.lead_id = ${leads.id}
          )
      )`,
    );
  }

  if (params.assignedBy) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${leadAssignments} la
        WHERE la.lead_id = ${leads.id}
          AND la.assigned_by = ${params.assignedBy}
      )`,
    );
  }

  if (params.originalOwner) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${leadAssignments} la
        WHERE la.lead_id = ${leads.id}
          AND la.to_agent_id = ${params.originalOwner}
          AND la.assigned_at = (
            SELECT MIN(la2.assigned_at) FROM ${leadAssignments} la2
            WHERE la2.lead_id = ${leads.id}
          )
      )`,
    );
  }

  if (params.tagPresets?.length) {
    const presetClauses = params.tagPresets.flatMap((preset) => {
      const config = TAG_PRESET_FILTER_SQL[preset];
      if (!config) return [];
      const parts: SQL[] = [];
      if (config.tags?.length) {
        for (const tag of config.tags) {
          parts.push(sql`${tag} = ANY(COALESCE(${leads.tags}, ARRAY[]::text[]))`);
        }
      }
      if (config.temperature) {
        parts.push(eq(leads.temperature, config.temperature));
      }
      if (config.status) {
        parts.push(eq(leads.leadStatus, config.status));
      }
      return parts.length > 0 ? [or(...parts)!] : [];
    });
    if (presetClauses.length > 0) {
      whereClauses.push(or(...presetClauses)!);
    }
  }

  const activityClauses: SQL[] = [];
  if (params.meetingDone) {
    activityClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${tasks} t
        WHERE t.lead_id = ${leads.id}
          AND t.task_type = 'meeting'
          AND t.status = 'completed'
      )`,
    );
  }
  if (params.meetingNotDone) {
    activityClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${tasks} t
        WHERE t.lead_id = ${leads.id}
          AND t.task_type = 'meeting'
          AND t.status IN ('pending', 'in_progress')
      )`,
    );
  }
  if (params.siteVisitDone) {
    activityClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${siteVisits} sv
        WHERE sv.lead_id = ${leads.id}
          AND sv.status = 'completed'
      )`,
    );
  }
  if (params.siteVisitNotDone) {
    activityClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${siteVisits} sv
        WHERE sv.lead_id = ${leads.id}
          AND sv.status = 'scheduled'
      )`,
    );
  }
  if (activityClauses.length > 0) {
    whereClauses.push(or(...activityClauses)!);
  }

  if (params.subStatus) {
    whereClauses.push(
      or(
        eq(leads.subStatus, params.subStatus),
        sql`${leads.customFields}->>'sub_status' = ${params.subStatus}`,
      )!,
    );
  }

  if (params.subSource) {
    whereClauses.push(ilike(sql`${leads.customFields}->>'sub_source'`, `%${params.subSource}%`));
  }

  if (params.projectStatus) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${projects} p
        WHERE p.id = ${leads.projectId}
          AND p.status = ${params.projectStatus}
      )`,
    );
  }

  if (params.hasProject) {
    whereClauses.push(isNotNull(leads.projectId));
  }

  if (params.possessionFrom) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${projects} p
        WHERE p.id = ${leads.projectId}
          AND p.possession_date >= ${params.possessionFrom}::date
      )`,
    );
  }

  if (params.possessionTo) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${projects} p
        WHERE p.id = ${leads.projectId}
          AND p.possession_date <= ${params.possessionTo}::date
      )`,
    );
  }

  if (params.city) {
    whereClauses.push(ilike(leads.city, `%${params.city}%`));
  }
  if (params.state) {
    whereClauses.push(ilike(leads.state, `%${params.state}%`));
  }
  if (params.locality) {
    whereClauses.push(ilike(leads.locality, `%${params.locality}%`));
  }
  if (params.country) {
    whereClauses.push(ilike(leads.country, `%${params.country}%`));
  }
  if (params.zone) {
    whereClauses.push(ilike(leads.zone, `%${params.zone}%`));
  }

  if (params.propertyStatus) {
    whereClauses.push(eq(leads.propertyStatus, params.propertyStatus));
  }
  if (params.propertyType) {
    whereClauses.push(eq(leads.propertyType, params.propertyType));
  }
  if (params.propertySubType) {
    whereClauses.push(eq(leads.propertySubType, params.propertySubType));
  }
  if (params.bhk) {
    whereClauses.push(eq(leads.bhk, params.bhk));
  }
  if (params.bhkType) {
    whereClauses.push(eq(leads.bhkType, params.bhkType));
  }

  if (params.countryCode) {
    whereClauses.push(ilike(leads.phone, `${params.countryCode}%`));
  }
  if (params.altCountryCode) {
    whereClauses.push(ilike(leads.secondaryPhone, `${params.altCountryCode}%`));
  }
  if (params.customerCountry) {
    whereClauses.push(ilike(leads.country, `%${params.customerCountry}%`));
  }

  if (params.minBudgetFrom !== undefined) {
    whereClauses.push(gte(leads.minBudget, String(params.minBudgetFrom)));
  }
  if (params.minBudgetTo !== undefined) {
    whereClauses.push(lte(leads.minBudget, String(params.minBudgetTo)));
  }
  if (params.maxBudgetFrom !== undefined) {
    whereClauses.push(gte(leads.maxBudget, String(params.maxBudgetFrom)));
  }
  if (params.maxBudgetTo !== undefined) {
    whereClauses.push(lte(leads.maxBudget, String(params.maxBudgetTo)));
  }

  if (params.carpetAreaFrom !== undefined) {
    whereClauses.push(gte(leads.carpetAreaSqft, String(params.carpetAreaFrom)));
  }
  if (params.carpetAreaTo !== undefined) {
    whereClauses.push(lte(leads.carpetAreaSqft, String(params.carpetAreaTo)));
  }
  if (params.builtUpAreaFrom !== undefined) {
    whereClauses.push(gte(leads.builtUpAreaSqft, String(params.builtUpAreaFrom)));
  }
  if (params.builtUpAreaTo !== undefined) {
    whereClauses.push(lte(leads.builtUpAreaSqft, String(params.builtUpAreaTo)));
  }

  if (
    params.latitude !== undefined &&
    params.longitude !== undefined &&
    params.radiusKm !== undefined
  ) {
    const lat = params.latitude;
    const lng = params.longitude;
    const radius = params.radiusKm;
    whereClauses.push(
      sql`(
        ${leads.latitude} IS NOT NULL
        AND ${leads.longitude} IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${lat})) * cos(radians(${leads.latitude}::float8))
              * cos(radians(${leads.longitude}::float8) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(${leads.latitude}::float8))
            ))
          )
        ) <= ${radius}
      )`,
    );
  }
}
