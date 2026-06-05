import { USER_ROLES } from "@propninja/types/enums";
import { z } from "zod";
import { paginationSchema } from "./common.js";

export const ASSIGNABLE_USER_ROLES = ["manager", "agent"] as const;

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ASSIGNABLE_USER_ROLES),
  phone: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined ||
      value.role !== undefined ||
      value.isActive !== undefined ||
      value.password !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
