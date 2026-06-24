import type { LeadAdvancedListQuery } from "./leadAdvancedListQuery.js";

type AdvancedListQueryInput = Partial<
  LeadAdvancedListQuery & {
    assignWithHistory?: boolean;
    assignedFrom?: string;
    assignedBy?: string;
    originalOwner?: string;
  }
>;

/** Pass advanced filter fields from parsed list query into leadService.listLeads. */
export function advancedListQueryToServiceParams(
  query: AdvancedListQueryInput,
): Partial<LeadAdvancedListQuery> {
  return {
    assignWithHistory: query.assignWithHistory,
    assignedFrom: query.assignedFrom,
    assignedBy: query.assignedBy,
    originalOwner: query.originalOwner,
    subStatus: query.subStatus,
    subSource: query.subSource,
    tagPresets: query.tagPresets,
    meetingDone: query.meetingDone,
    meetingNotDone: query.meetingNotDone,
    siteVisitDone: query.siteVisitDone,
    siteVisitNotDone: query.siteVisitNotDone,
    projectStatus: query.projectStatus,
    hasProject: query.hasProject,
    possessionFrom: query.possessionFrom,
    possessionTo: query.possessionTo,
    city: query.city,
    state: query.state,
    locality: query.locality,
    country: query.country,
    zone: query.zone,
    latitude: query.latitude,
    longitude: query.longitude,
    radiusKm: query.radiusKm,
    countryCode: query.countryCode,
    altCountryCode: query.altCountryCode,
    customerCountry: query.customerCountry,
    propertyStatus: query.propertyStatus,
    propertyType: query.propertyType,
    propertySubType: query.propertySubType,
    bhk: query.bhk,
    bhkType: query.bhkType,
    minBudgetFrom: query.minBudgetFrom,
    minBudgetTo: query.minBudgetTo,
    maxBudgetFrom: query.maxBudgetFrom,
    maxBudgetTo: query.maxBudgetTo,
    carpetAreaFrom: query.carpetAreaFrom,
    carpetAreaTo: query.carpetAreaTo,
    builtUpAreaFrom: query.builtUpAreaFrom,
    builtUpAreaTo: query.builtUpAreaTo,
  };
}
