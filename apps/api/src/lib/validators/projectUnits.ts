import { z } from "zod";

export const unitStatusSchema = z.enum(["available", "reserved", "booked", "sold"]);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const unitBedroomsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const projectIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const projectUnitParamSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
});

export const listProjectUnitsQuerySchema = z.object({
  status: unitStatusSchema.optional(),
  bedrooms: z.coerce.number().int().min(1).max(4).optional(),
  floor: z.coerce.number().int().optional(),
});

export type ListProjectUnitsQuery = z.infer<typeof listProjectUnitsQuerySchema>;

const unitFieldsSchema = z.object({
  unitNumber: z.string().trim().min(1).max(50),
  floor: z.coerce.number().int(),
  bedrooms: unitBedroomsSchema,
  areaSqFt: z.coerce.number().positive(),
  priceListedRs: z.coerce.number().int().nonnegative(),
  priceFinalRs: z.coerce.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const createProjectUnitSchema = unitFieldsSchema.extend({
  status: unitStatusSchema.optional().default("available"),
});

export const bulkCreateProjectUnitsSchema = z
  .object({
    unitNumberFrom: z.string().trim().min(1).max(50),
    unitNumberTo: z.string().trim().min(1).max(50),
    floor: z.coerce.number().int(),
    bedrooms: unitBedroomsSchema,
    areaSqFt: z.coerce.number().positive(),
    priceListedRs: z.coerce.number().int().nonnegative(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((data) => data.unitNumberFrom !== data.unitNumberTo || data.unitNumberFrom.length > 0, {
    message: "Range must include at least one unit",
  });

export const createProjectUnitsBodySchema = z.union([
  z.object({ unit: createProjectUnitSchema }),
  z.object({ bulk: bulkCreateProjectUnitsSchema }),
  z.object({ units: z.array(createProjectUnitSchema).min(1).max(500) }),
]);

export type CreateProjectUnitsBody = z.infer<typeof createProjectUnitsBodySchema>;

export const updateProjectUnitSchema = z
  .object({
    status: unitStatusSchema.optional(),
    priceListedRs: z.coerce.number().int().nonnegative().optional(),
    priceFinalRs: z.coerce.number().int().nonnegative().nullable().optional(),
    assignedLeadId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    floor: z.coerce.number().int().optional(),
    bedrooms: unitBedroomsSchema.optional(),
    areaSqFt: z.coerce.number().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field required" });

export type UpdateProjectUnitInput = z.infer<typeof updateProjectUnitSchema>;

export const reserveUnitSchema = z.object({
  leadId: z.string().uuid(),
});

export type ReserveUnitInput = z.infer<typeof reserveUnitSchema>;

export const bookUnitSchema = z.object({
  priceFinalRs: z.coerce.number().int().nonnegative().optional(),
});

export type BookUnitInput = z.infer<typeof bookUnitSchema>;
