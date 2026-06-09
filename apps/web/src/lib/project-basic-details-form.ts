import type { CreateProjectInput, ProjectDetail, UpdateProjectPayload } from "@/hooks/use-projects";
import { z } from "zod";

export const FACING_OPTIONS = [
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "north_east", label: "North-East" },
  { value: "north_west", label: "North-West" },
  { value: "south_east", label: "South-East" },
  { value: "south_west", label: "South-West" },
] as const;

export const PROJECT_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "agricultural", label: "Agricultural" },
  { value: "plot", label: "Plot" },
] as const;

export const PROJECT_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "pre_launch", label: "Pre Launch" },
  { value: "launch", label: "Launch" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
] as const;

const projectTypeValues = ["residential", "commercial", "agricultural", "plot"] as const;
const projectStatusValues = ["new", "pre_launch", "launch", "ongoing", "completed"] as const;

export const projectBasicDetailsSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  projectType: z.enum(projectTypeValues, { required_error: "Project type is required" }),
  subType: z.string().optional(),
  status: z.enum(projectStatusValues, { required_error: "Status is required" }),
  landArea: z.string().optional(),
  certificate: z.string().optional(),
  facing: z.array(z.string()),
  description: z.string().optional(),
  notes: z.string().optional(),
  builderName: z.string().optional(),
  builderPhone: z.string().optional(),
  builderContactName: z.string().optional(),
  builderContactPhone: z.string().optional(),
  reraNumbers: z.array(z.string().min(1)),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  brokeragePercent: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  possessionDate: z.string().optional(),
});

export type ProjectBasicDetailsFormValues = z.infer<typeof projectBasicDetailsSchema>;

export const defaultBasicDetailsValues: ProjectBasicDetailsFormValues = {
  name: "",
  projectType: "residential",
  subType: "",
  status: "new",
  landArea: "",
  certificate: "",
  facing: [],
  description: "",
  notes: "",
  builderName: "",
  builderPhone: "",
  builderContactName: "",
  builderContactPhone: "",
  reraNumbers: [],
  minPrice: "",
  maxPrice: "",
  brokeragePercent: "",
  startDate: "",
  endDate: "",
  possessionDate: "",
};

function categoryFromProjectType(projectType: string) {
  if (projectType === "commercial") return "commercial" as const;
  if (projectType === "agricultural") return "agricultural" as const;
  return "residential" as const;
}

function parseOptionalNumber(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function projectToBasicDetailsForm(project: ProjectDetail): ProjectBasicDetailsFormValues {
  const projectType = projectTypeValues.includes(
    project.projectType as (typeof projectTypeValues)[number],
  )
    ? (project.projectType as ProjectBasicDetailsFormValues["projectType"])
    : "residential";

  const status = projectStatusValues.includes(
    project.status as (typeof projectStatusValues)[number],
  )
    ? (project.status as ProjectBasicDetailsFormValues["status"])
    : "new";

  return {
    name: project.name,
    projectType,
    subType: project.subType ?? "",
    status,
    landArea: project.landArea ?? "",
    certificate: project.certificate ?? "",
    facing: project.facing ?? [],
    description: project.description ?? "",
    notes: project.notes ?? "",
    builderName: project.builderName ?? "",
    builderPhone: project.builderPhone ?? "",
    builderContactName: project.builderContactName ?? "",
    builderContactPhone: project.builderContactPhone ?? "",
    reraNumbers: project.reraNumbers ?? [],
    minPrice: project.minPrice != null ? String(project.minPrice) : "",
    maxPrice: project.maxPrice != null ? String(project.maxPrice) : "",
    brokeragePercent: project.brokeragePercent != null ? String(project.brokeragePercent) : "",
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    possessionDate: project.possessionDate ?? "",
  };
}

export function basicDetailsToCreatePayload(
  values: ProjectBasicDetailsFormValues,
): CreateProjectInput {
  return {
    name: values.name.trim(),
    projectType: values.projectType,
    category: categoryFromProjectType(values.projectType),
    status: values.status,
    subType: trimOptional(values.subType),
    landArea: trimOptional(values.landArea),
    certificate: trimOptional(values.certificate),
    facing: values.facing.length > 0 ? values.facing : undefined,
    description: trimOptional(values.description),
    notes: trimOptional(values.notes),
    builderName: trimOptional(values.builderName),
    builderPhone: trimOptional(values.builderPhone),
    builderContactName: trimOptional(values.builderContactName),
    builderContactPhone: trimOptional(values.builderContactPhone),
    reraNumbers: values.reraNumbers.length > 0 ? values.reraNumbers : undefined,
    minPrice: parseOptionalNumber(values.minPrice),
    maxPrice: parseOptionalNumber(values.maxPrice),
    brokeragePercent: parseOptionalNumber(values.brokeragePercent),
    startDate: trimOptional(values.startDate),
    endDate: trimOptional(values.endDate),
    possessionDate: trimOptional(values.possessionDate),
  };
}

export function basicDetailsToUpdatePayload(
  values: ProjectBasicDetailsFormValues,
): UpdateProjectPayload {
  const createPayload = basicDetailsToCreatePayload(values);

  return {
    name: createPayload.name,
    projectType: createPayload.projectType,
    category: createPayload.category,
    status: createPayload.status,
    subType: trimOptional(values.subType) ?? null,
    landArea: trimOptional(values.landArea) ?? null,
    certificate: trimOptional(values.certificate) ?? null,
    facing: values.facing.length > 0 ? values.facing : null,
    description: trimOptional(values.description) ?? null,
    notes: trimOptional(values.notes) ?? null,
    builderName: trimOptional(values.builderName) ?? null,
    builderPhone: trimOptional(values.builderPhone) ?? null,
    builderContactName: trimOptional(values.builderContactName) ?? null,
    builderContactPhone: trimOptional(values.builderContactPhone) ?? null,
    reraNumbers: values.reraNumbers.length > 0 ? values.reraNumbers : null,
    minPrice: parseOptionalNumber(values.minPrice) ?? null,
    maxPrice: parseOptionalNumber(values.maxPrice) ?? null,
    brokeragePercent: parseOptionalNumber(values.brokeragePercent) ?? null,
    startDate: trimOptional(values.startDate) ?? null,
    endDate: trimOptional(values.endDate) ?? null,
    possessionDate: trimOptional(values.possessionDate) ?? null,
  };
}

export function parseReraInput(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
