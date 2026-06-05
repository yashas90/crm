import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/propninja"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DEMO_ORG_ID: z.string().uuid().default("00000000-0000-0000-0000-0000000000aa"),
  DEMO_USER_ID: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
  DEMO_USER_EMAIL: z.string().email().default("demo@propninja.local"),
  DEMO_USER_NAME: z.string().min(1).default("Demo Agent"),
  DEMO_USER_ROLE: z.enum(["admin", "manager", "agent"]).default("admin"),
  DEMO_ORG_NAME: z.string().min(1).default("Demo Organization"),
  DEMO_ORG_SLUG: z.string().min(1).default("demo"),
  ALLOW_DEMO_AUTH: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  AUTH_JWT_SECRET: z.string().min(16, "AUTH_JWT_SECRET is required (min 16 characters)"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
