import { USER_ROLES } from "@propninja/types/enums";
import { z } from "zod";
import { paginationSchema } from "./common.js";

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "At least one of role or isActive must be provided",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
