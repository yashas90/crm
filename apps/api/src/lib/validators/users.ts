import { USER_ROLES } from "@propninja/types/enums";
import { z } from "zod";
import { deriveUsernameFromEmail } from "../deriveUsername.js";
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
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional().default(true),
    /** Legacy / extended fields */
    username: usernameSchema.optional(),
    workEmail: z.string().email().optional(),
    roleLabel: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    ...profileFieldsSchema,
  })
  .transform((value) => {
    const email = value.email.toLowerCase();
    const roleLabel = value.roleLabel?.trim();
    const role = value.role ?? (roleLabel ? mapRoleLabelToRole(roleLabel) : "agent");

    return {
      ...value,
      email,
      workEmail: (value.workEmail ?? email).toLowerCase(),
      username: (value.username ?? deriveUsernameFromEmail(email)).toLowerCase(),
      role,
      roleLabel:
        roleLabel || (role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Basic"),
      isActive: value.isActive ?? true,
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

export const resetUserPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strip();

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strip();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
