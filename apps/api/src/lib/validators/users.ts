import { USER_ROLES } from "@propninja/types/enums";
import { z } from "zod";
import { mapRoleLabelToRole } from "../role-mapping.js";
import { paginationSchema } from "./common.js";

export const ASSIGNABLE_USER_ROLES = ["manager", "agent"] as const;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username may only contain letters, numbers, dots, hyphens, and underscores",
  );

const profileFieldsSchema = {
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  workPhone: z.string().trim().optional(),
  personalPhone: z.string().trim().optional(),
  homeLocation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  timeZone: z.string().trim().optional(),
  brokerNumber: z.string().trim().optional(),
  description: z.string().trim().optional(),
  generalManagerId: z.string().uuid().nullable().optional(),
  reportingToId: z.string().uuid().nullable().optional(),
};

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(["active", "inactive", "all"]).optional().default("all"),
  /** @deprecated Use `status` */
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userScopeCountsQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export type UserScopeCountsQuery = z.infer<typeof userScopeCountsQuerySchema>;

export const userExportQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "all"]).optional().default("all"),
});

export type UserExportQuery = z.infer<typeof userExportQuerySchema>;

export const createUserSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email("Valid email is required").optional(),
    workEmail: z.string().email("Work email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    /** Legacy clients may send role; roleLabel from the form is authoritative. */
    role: z.enum(USER_ROLES).optional(),
    roleLabel: z.string().trim().min(1, "Role label is required"),
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional(),
    ...profileFieldsSchema,
  })
  .transform((value) => {
    const roleLabel = value.roleLabel.trim();
    const role = mapRoleLabelToRole(roleLabel);

    return {
      ...value,
      email: (value.email ?? value.workEmail).toLowerCase(),
      workEmail: value.workEmail.toLowerCase(),
      roleLabel,
      role,
    };
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().nullable().optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
    firstName: z.string().trim().nullable().optional(),
    lastName: z.string().trim().nullable().optional(),
    workEmail: z.string().email().nullable().optional(),
    workPhone: z.string().trim().nullable().optional(),
    personalPhone: z.string().trim().nullable().optional(),
    homeLocation: z.string().trim().nullable().optional(),
    department: z.string().trim().nullable().optional(),
    designation: z.string().trim().nullable().optional(),
    timeZone: z.string().trim().nullable().optional(),
    brokerNumber: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    roleLabel: z.string().trim().nullable().optional(),
    generalManagerId: z.string().uuid().nullable().optional(),
    reportingToId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
