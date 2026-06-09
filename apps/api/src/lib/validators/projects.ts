import { z } from "zod";
import { commaSeparated, paginationSchema } from "./common.js";

export const projectStatusSchema = z.enum(["new", "pre_launch", "launch", "ongoing", "completed"]);

export const projectCategorySchema = z.enum(["residential", "commercial", "agricultural"]);

export const projectTypeSchema = z.enum([
  "residential",
  "commercial",
  "agricultural",
  "plot",
  "mixed",
]);

const optionalBooleanQuery = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const listProjectsQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  category: projectCategorySchema.optional(),
  status: projectStatusSchema.optional(),
  statuses: commaSeparated(projectStatusSchema).optional(),
  availability: optionalBooleanQuery,
  /** @deprecated Use `availability` */
  isActive: optionalBooleanQuery,
  assignedTo: z.string().uuid().optional(),
  deletedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const projectScopeCountsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: projectCategorySchema.optional(),
});

export type ProjectScopeCountsQuery = z.infer<typeof projectScopeCountsQuerySchema>;

const projectUnitTypeSchema = z.object({
  type: z.string().trim().min(1),
  count: z.coerce.number().int().nonnegative(),
  carpetArea: z.string().trim().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});

export const projectUnitsInfoSchema = z.object({
  units: z.array(projectUnitTypeSchema),
});

export const projectBlocksInfoSchema = z.object({
  numberOfBlocks: z.coerce.number().int().nonnegative().optional(),
  floorsPerBlock: z.coerce.number().int().nonnegative().optional(),
  unitsPerFloor: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export const projectGalleryItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  placeholder: z.boolean().optional(),
});

export const projectGallerySchema = z.object({
  items: z.array(projectGalleryItemSchema),
});

const projectFieldsSchema = {
  name: z.string().min(1, "Project name is required"),
  status: projectStatusSchema.optional(),
  projectType: projectTypeSchema,
  category: projectCategorySchema.optional(),
  subType: z.string().trim().optional(),
  availability: z.boolean().optional(),
  facing: z.array(z.string().trim().min(1)).optional(),
  landArea: z.string().trim().optional(),
  certificate: z.string().trim().optional(),
  description: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  builderName: z.string().trim().optional(),
  builderPhone: z.string().trim().optional(),
  builderContactName: z.string().trim().optional(),
  builderContactPhone: z.string().trim().optional(),
  reraNumbers: z.array(z.string().trim().min(1)).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  brokeragePercent: z.coerce.number().min(0).max(100).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  possessionDate: z.string().date().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  unitsInfo: projectUnitsInfoSchema.optional(),
  blocksInfo: projectBlocksInfoSchema.optional(),
  amenities: z.array(z.string().trim().min(1)).optional(),
  gallery: projectGallerySchema.optional(),
};

export const createProjectSchema = z.object(projectFieldsSchema);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: projectStatusSchema.optional(),
    projectType: projectTypeSchema.optional(),
    category: projectCategorySchema.optional(),
    subType: z.string().trim().nullable().optional(),
    availability: z.boolean().optional(),
    facing: z.array(z.string().trim().min(1)).nullable().optional(),
    landArea: z.string().trim().nullable().optional(),
    certificate: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    builderName: z.string().trim().nullable().optional(),
    builderPhone: z.string().trim().nullable().optional(),
    builderContactName: z.string().trim().nullable().optional(),
    builderContactPhone: z.string().trim().nullable().optional(),
    reraNumbers: z.array(z.string().trim().min(1)).nullable().optional(),
    minPrice: z.coerce.number().nonnegative().nullable().optional(),
    maxPrice: z.coerce.number().nonnegative().nullable().optional(),
    brokeragePercent: z.coerce.number().min(0).max(100).nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    possessionDate: z.string().date().nullable().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    unitsInfo: projectUnitsInfoSchema.nullable().optional(),
    blocksInfo: projectBlocksInfoSchema.nullable().optional(),
    amenities: z.array(z.string().trim().min(1)).nullable().optional(),
    gallery: projectGallerySchema.nullable().optional(),
    /** @deprecated Use `availability` */
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const toggleProjectAvailabilitySchema = z.object({
  availability: z.boolean(),
});

export type ToggleProjectAvailabilityInput = z.infer<typeof toggleProjectAvailabilitySchema>;
