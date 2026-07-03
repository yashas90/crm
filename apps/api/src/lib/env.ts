import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://postgres:postgres@localhost:5432/propninja"),
    /** Postgres pool size per API instance. Use 20–30 for ~20 concurrent field agents. */
    DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(25),
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
      .default("false")
      .transform((v) => v === "true"),
    AUTH_JWT_SECRET: z.string().min(16, "AUTH_JWT_SECRET is required (min 16 characters)"),
    /** JWT access-token lifetime (jose duration string, e.g. 15m, 8h). */
    JWT_EXPIRES_IN: z.string().min(1).default("15m"),
    /** Refresh-token lifetime (duration string, e.g. 7d). */
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),
    /** Optional — enables Sentry error tracking when set. */
    SENTRY_DSN: z.string().url().optional(),
    /** Git commit SHA for Sentry release tracking (set automatically on Railway). */
    RAILWAY_GIT_COMMIT_SHA: z.string().min(1).optional(),
    /** Optional — Redis URL for distributed rate limiting (falls back to in-memory when unset). */
    REDIS_URL: z.string().min(1).optional(),
    /** Optional — dedicated key for encrypting OAuth tokens at rest (falls back to AUTH_JWT_SECRET). */
    TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
    /** Twilio SMS — optional; required to send outbound SMS after TCF consent. */
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_FROM_NUMBER: z.string().min(1).optional(),
    /** When true, META_VERIFY_TOKEN and META_APP_SECRET are required at startup. */
    META_WEBHOOK_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /**
     * Shared secret for Meta webhook subscription handshake.
     * Required when META_WEBHOOK_ENABLED=true (no dev default in that case).
     */
    META_VERIFY_TOKEN: z.string().min(1).optional(),
    /** App secret for X-Hub-Signature-256 verification. Required when META_WEBHOOK_ENABLED=true. */
    META_APP_SECRET: z.string().min(1).optional(),
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
    /** Cloudflare R2 — optional; required for document/booking PDF uploads. */
    CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1).optional(),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    CLOUDFLARE_R2_BUCKET_NAME: z.string().min(1).optional(),
    CLOUDFLARE_R2_PUBLIC_URL: z.string().url().optional(),
    /** Public API base URL for generated webhook links (no trailing slash). */
    PUBLIC_API_BASE_URL: z.string().url().optional(),
    API_PUBLIC_URL: z.string().url().optional(),
    WEB_APP_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),
    REPORT_EMAIL_UNSUBSCRIBE_SECRET: z.string().min(1).optional(),
    WHATSAPP_API_TOKEN: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
    /** Optional — Expo push notification access token. */
    EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
    CORS_ORIGINS: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.META_WEBHOOK_ENABLED) return;

    if (!data.META_VERIFY_TOKEN?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["META_VERIFY_TOKEN"],
        message: "META_VERIFY_TOKEN is required when META_WEBHOOK_ENABLED=true",
      });
    }

    if (!data.META_APP_SECRET?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["META_APP_SECRET"],
        message: "META_APP_SECRET is required when META_WEBHOOK_ENABLED=true",
      });
    }
  })
  .transform((data) => ({
    ...data,
    META_VERIFY_TOKEN: data.META_VERIFY_TOKEN ?? "dev-meta-verify-token",
  }));

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
