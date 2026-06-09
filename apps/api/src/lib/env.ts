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
  META_VERIFY_TOKEN: z.string().min(1).default("dev-meta-verify-token"),
  /** Optional — enable X-Hub-Signature-256 verification when set. */
  META_APP_SECRET: z.string().optional(),
  /** Page access token for Facebook Graph API lead detail fetches. */
  PAGE_ACCESS_TOKEN: z.string().optional(),
  /** Expected Facebook Page ID (display / ops reference). */
  META_PAGE_ID: z.string().optional(),
  /** Comma-separated lead form IDs monitored via webhook (display only). */
  META_FORM_IDS: z.string().optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),
  /** Manager account ID when accessing a client customer via MCC. */
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_SYNC_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_ADS_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(600_000),
  GOOGLE_ADS_LOOKBACK_MINUTES: z.coerce.number().int().positive().default(70),
  /** Overlap window when resuming from DB watermark (avoids missing edge submissions). */
  GOOGLE_ADS_SYNC_OVERLAP_MINUTES: z.coerce.number().int().nonnegative().default(5),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
