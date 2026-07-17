-- Meta Business Integration: multi-page / multi-pixel / CAPI / insights tables

CREATE TABLE IF NOT EXISTS "facebook_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "meta_user_id" text,
  "token_type" text NOT NULL DEFAULT 'user',
  "access_token_encrypted" text NOT NULL,
  "refresh_token_encrypted" text,
  "scopes" text[],
  "expires_at" timestamptz,
  "token_data_access_expires_at" timestamptz,
  "last_refreshed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "facebook_tokens_token_type_check"
    CHECK ("token_type" IN ('user', 'page', 'system')),
  CONSTRAINT "facebook_tokens_status_check"
    CHECK ("status" IN ('active', 'expired', 'revoked', 'error'))
);

CREATE INDEX IF NOT EXISTS "facebook_tokens_org_id_idx" ON "facebook_tokens" ("org_id");
CREATE INDEX IF NOT EXISTS "facebook_tokens_status_idx" ON "facebook_tokens" ("org_id", "status");

CREATE TABLE IF NOT EXISTS "facebook_businesses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "token_id" uuid REFERENCES "facebook_tokens"("id") ON DELETE SET NULL,
  "business_id" text NOT NULL,
  "name" text NOT NULL,
  "verification_status" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "connected_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_businesses_org_business_id_uidx"
  ON "facebook_businesses" ("org_id", "business_id");
CREATE INDEX IF NOT EXISTS "facebook_businesses_org_id_idx" ON "facebook_businesses" ("org_id");

CREATE TABLE IF NOT EXISTS "facebook_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "business_id" uuid REFERENCES "facebook_businesses"("id") ON DELETE SET NULL,
  "ad_account_id" text NOT NULL,
  "name" text NOT NULL,
  "currency" text,
  "timezone_name" text,
  "account_status" integer,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_accounts_org_ad_account_uidx"
  ON "facebook_accounts" ("org_id", "ad_account_id");
CREATE INDEX IF NOT EXISTS "facebook_accounts_org_id_idx" ON "facebook_accounts" ("org_id");
CREATE INDEX IF NOT EXISTS "facebook_accounts_business_id_idx" ON "facebook_accounts" ("business_id");

CREATE TABLE IF NOT EXISTS "facebook_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "business_id" uuid REFERENCES "facebook_businesses"("id") ON DELETE SET NULL,
  "page_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "access_token_encrypted" text,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "leadgen_subscribed" boolean NOT NULL DEFAULT false,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_pages_org_page_id_uidx"
  ON "facebook_pages" ("org_id", "page_id");
CREATE INDEX IF NOT EXISTS "facebook_pages_org_id_idx" ON "facebook_pages" ("org_id");
CREATE INDEX IF NOT EXISTS "facebook_pages_page_id_idx" ON "facebook_pages" ("page_id");

CREATE TABLE IF NOT EXISTS "instagram_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "page_id" uuid REFERENCES "facebook_pages"("id") ON DELETE CASCADE,
  "ig_user_id" text NOT NULL,
  "username" text,
  "name" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "instagram_accounts_org_ig_user_uidx"
  ON "instagram_accounts" ("org_id", "ig_user_id");
CREATE INDEX IF NOT EXISTS "instagram_accounts_page_id_idx" ON "instagram_accounts" ("page_id");

CREATE TABLE IF NOT EXISTS "facebook_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "page_id" uuid NOT NULL REFERENCES "facebook_pages"("id") ON DELETE CASCADE,
  "form_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "locale" text,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "field_mapping" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_forms_org_form_id_uidx"
  ON "facebook_forms" ("org_id", "form_id");
CREATE INDEX IF NOT EXISTS "facebook_forms_page_id_idx" ON "facebook_forms" ("page_id");
CREATE INDEX IF NOT EXISTS "facebook_forms_org_id_idx" ON "facebook_forms" ("org_id");

CREATE TABLE IF NOT EXISTS "facebook_pixels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "business_id" uuid REFERENCES "facebook_businesses"("id") ON DELETE SET NULL,
  "ad_account_id" uuid REFERENCES "facebook_accounts"("id") ON DELETE SET NULL,
  "pixel_id" text NOT NULL,
  "name" text NOT NULL,
  "access_token_encrypted" text,
  "is_selected" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_pixels_org_pixel_id_uidx"
  ON "facebook_pixels" ("org_id", "pixel_id");
CREATE INDEX IF NOT EXISTS "facebook_pixels_org_id_idx" ON "facebook_pixels" ("org_id");

CREATE TABLE IF NOT EXISTS "facebook_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "page_id" uuid REFERENCES "facebook_pages"("id") ON DELETE SET NULL,
  "meta_page_id" text,
  "event_type" text NOT NULL DEFAULT 'leadgen',
  "external_event_id" text,
  "dedupe_key" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "signature_valid" boolean,
  "status" text NOT NULL DEFAULT 'received',
  "processed_at" timestamptz,
  "error_message" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "facebook_webhooks_status_check"
    CHECK ("status" IN ('received', 'queued', 'processing', 'processed', 'failed', 'duplicate', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_webhooks_org_dedupe_uidx"
  ON "facebook_webhooks" ("org_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "facebook_webhooks_status_idx"
  ON "facebook_webhooks" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "facebook_webhooks_created_at_idx"
  ON "facebook_webhooks" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "facebook_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "ad_account_id" uuid REFERENCES "facebook_accounts"("id") ON DELETE CASCADE,
  "campaign_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "objective" text,
  "daily_budget" numeric(14, 2),
  "lifetime_budget" numeric(14, 2),
  "start_time" timestamptz,
  "stop_time" timestamptz,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "insights" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "insights_synced_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_campaigns_org_campaign_uidx"
  ON "facebook_campaigns" ("org_id", "campaign_id");
CREATE INDEX IF NOT EXISTS "facebook_campaigns_ad_account_idx"
  ON "facebook_campaigns" ("ad_account_id");

CREATE TABLE IF NOT EXISTS "facebook_adsets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "campaign_id" uuid REFERENCES "facebook_campaigns"("id") ON DELETE CASCADE,
  "adset_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "daily_budget" numeric(14, 2),
  "insights" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "insights_synced_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_adsets_org_adset_uidx"
  ON "facebook_adsets" ("org_id", "adset_id");
CREATE INDEX IF NOT EXISTS "facebook_adsets_campaign_idx" ON "facebook_adsets" ("campaign_id");

CREATE TABLE IF NOT EXISTS "facebook_ads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "adset_id" uuid REFERENCES "facebook_adsets"("id") ON DELETE CASCADE,
  "ad_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "creative_id" text,
  "insights" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "insights_synced_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_ads_org_ad_uidx"
  ON "facebook_ads" ("org_id", "ad_id");
CREATE INDEX IF NOT EXISTS "facebook_ads_adset_idx" ON "facebook_ads" ("adset_id");

CREATE TABLE IF NOT EXISTS "facebook_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "leadgen_id" text NOT NULL,
  "page_id" text,
  "form_id" text,
  "campaign_id" text,
  "adset_id" text,
  "ad_id" text,
  "campaign_name" text,
  "adset_name" text,
  "ad_name" text,
  "form_name" text,
  "page_name" text,
  "pixel_id" text,
  "full_name" text,
  "email" text,
  "phone" text,
  "city" text,
  "state" text,
  "country" text,
  "zip" text,
  "fbclid" text,
  "fbc" text,
  "fbp" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_term" text,
  "field_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "raw_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_time" timestamptz,
  "ingested_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_leads_org_leadgen_uidx"
  ON "facebook_leads" ("org_id", "leadgen_id");
CREATE INDEX IF NOT EXISTS "facebook_leads_lead_id_idx" ON "facebook_leads" ("lead_id");
CREATE INDEX IF NOT EXISTS "facebook_leads_campaign_id_idx"
  ON "facebook_leads" ("org_id", "campaign_id");
CREATE INDEX IF NOT EXISTS "facebook_leads_created_time_idx"
  ON "facebook_leads" ("org_id", "created_time" DESC);

CREATE TABLE IF NOT EXISTS "facebook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "event_name" text NOT NULL,
  "source" text NOT NULL DEFAULT 'webhook',
  "external_id" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'received',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "facebook_events_org_created_idx"
  ON "facebook_events" ("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "facebook_events_external_id_idx"
  ON "facebook_events" ("org_id", "external_id");

CREATE TABLE IF NOT EXISTS "facebook_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "level" text NOT NULL DEFAULT 'info',
  "category" text NOT NULL,
  "message" text NOT NULL,
  "request_id" text,
  "latency_ms" integer,
  "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "facebook_logs_level_check"
    CHECK ("level" IN ('debug', 'info', 'warn', 'error'))
);

CREATE INDEX IF NOT EXISTS "facebook_logs_org_created_idx"
  ON "facebook_logs" ("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "facebook_logs_category_idx"
  ON "facebook_logs" ("org_id", "category");

CREATE TABLE IF NOT EXISTS "facebook_conversion_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "pixel_id" text NOT NULL,
  "event_name" text NOT NULL,
  "event_id" text NOT NULL,
  "event_time" timestamptz NOT NULL,
  "action_source" text NOT NULL DEFAULT 'system_generated',
  "event_source_url" text,
  "user_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "custom_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "http_status" integer,
  "response_payload" jsonb,
  "error_message" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "next_retry_at" timestamptz,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "facebook_conversion_events_status_check"
    CHECK ("status" IN ('pending', 'sent', 'failed', 'skipped', 'deduped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_conversion_events_event_id_uidx"
  ON "facebook_conversion_events" ("org_id", "event_id");
CREATE INDEX IF NOT EXISTS "facebook_conversion_events_status_idx"
  ON "facebook_conversion_events" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "facebook_conversion_events_lead_idx"
  ON "facebook_conversion_events" ("lead_id");

CREATE TABLE IF NOT EXISTS "facebook_sync_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "sync_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "records_processed" integer NOT NULL DEFAULT 0,
  "records_failed" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "facebook_sync_history_status_check"
    CHECK ("status" IN ('running', 'success', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS "facebook_sync_history_org_started_idx"
  ON "facebook_sync_history" ("org_id", "started_at" DESC);

CREATE TABLE IF NOT EXISTS "facebook_errors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "source" text NOT NULL,
  "error_code" text,
  "error_subcode" text,
  "message" text NOT NULL,
  "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "resolved" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "facebook_errors_org_created_idx"
  ON "facebook_errors" ("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "facebook_errors_unresolved_idx"
  ON "facebook_errors" ("org_id", "resolved");

CREATE TABLE IF NOT EXISTS "facebook_rate_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "endpoint" text NOT NULL,
  "call_count" integer NOT NULL DEFAULT 0,
  "estimated_time_to_regain_access" integer,
  "app_usage_percent" numeric(5, 2),
  "business_usage_percent" numeric(5, 2),
  "window_started_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "facebook_rate_limits_org_endpoint_uidx"
  ON "facebook_rate_limits" ("org_id", "endpoint");
