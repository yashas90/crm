import { z } from "zod";

const grade = z.enum(["NE", "N0", "N1", "N2", "N3"]);
const quarter = z.string().regex(/^\d{4}-(JFM|AMJ|JAS|OND)$/);
const month = z.string().regex(/^\d{4}-\d{2}$/);

export const approvalFilterSchema = z.object({
  month: month.optional(),
  quarter: quarter.optional(),
  grade: grade.optional(),
  status: z.string().trim().min(1).optional(),
  q: z.string().trim().max(120).optional(),
  eligible: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(1, "A written reason is required").max(1000),
});

export const calculateIncentiveSchema = z.object({
  month: month.optional(),
});

export const calculateAppraisalSchema = z.object({
  quarter: quarter.optional(),
});

export const disburseBodySchema = z.object({
  quarter,
  userId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const overrideIncentiveSchema = z.object({
  monthlySalary: z.number().min(0).optional(),
  eligibilityTarget: z.number().min(0).optional(),
  nrAchieved: z.number().min(0).optional(),
  incentiveTillTarget: z.number().min(0).optional(),
  incentiveAboveTarget: z.number().min(0).optional(),
  n1Bonus: z.number().min(0).optional(),
});
