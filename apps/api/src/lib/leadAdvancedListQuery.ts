import { z } from "zod";

const boolFromQuery = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

const commaList = z
  .string()
  .optional()
  .transform((value) => {
    if (!value?.trim()) return undefined;
    const items = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  });

const optionalUuid = z.string().uuid().optional();

const optionalNumber = z.coerce.number().optional();

/** Extended list query fields for advanced lead filters. */
export const leadAdvancedListQuerySchema = z.object({
  assignWithHistory: boolFromQuery,
  assignedFrom: optionalUuid,
  assignedBy: optionalUuid,
  originalOwner: optionalUuid,
  subStatus: z.string().optional(),
  subSource: z.string().optional(),
  tagPresets: commaList,
  meetingDone: boolFromQuery,
  meetingNotDone: boolFromQuery,
  siteVisitDone: boolFromQuery,
  siteVisitNotDone: boolFromQuery,
  projectStatus: z.string().optional(),
  hasProject: boolFromQuery,
  possessionFrom: z.string().optional(),
  possessionTo: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  locality: z.string().optional(),
  country: z.string().optional(),
  zone: z.string().optional(),
  latitude: optionalNumber,
  longitude: optionalNumber,
  radiusKm: optionalNumber,
  countryCode: z.string().optional(),
  altCountryCode: z.string().optional(),
  customerCountry: z.string().optional(),
  propertyStatus: z.string().optional(),
  propertyType: z.string().optional(),
  propertySubType: z.string().optional(),
  bhk: z.string().optional(),
  bhkType: z.string().optional(),
  minBudgetFrom: optionalNumber,
  minBudgetTo: optionalNumber,
  maxBudgetFrom: optionalNumber,
  maxBudgetTo: optionalNumber,
  carpetAreaFrom: optionalNumber,
  carpetAreaTo: optionalNumber,
  builtUpAreaFrom: optionalNumber,
  builtUpAreaTo: optionalNumber,
});

export type LeadAdvancedListQuery = z.infer<typeof leadAdvancedListQuerySchema>;

export const TAG_PRESET_FILTER_SQL: Record<
  string,
  { tags?: string[]; temperature?: string; status?: string }
> = {
  about_to_convert: { tags: ["about_to_convert"], status: "negotiation" },
  cold: { tags: ["cold"], temperature: "cold" },
  escalated: { tags: ["escalated"] },
  highlighted: { tags: ["highlighted"] },
  hot: { tags: ["hot"], temperature: "hot" },
  warm: { tags: ["warm"], temperature: "warm" },
};
