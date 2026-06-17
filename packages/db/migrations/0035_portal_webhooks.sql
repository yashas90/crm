CREATE TABLE IF NOT EXISTS "portal_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "portal_name" text NOT NULL,
  "webhook_token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "field_mapping" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_lead_received_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "portal_webhooks_portal_name_check"
    CHECK ("portal_name" IN ('99acres', 'magicbricks', 'housing', 'indiamrt', 'other'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_webhooks_token_idx"
  ON "portal_webhooks" ("webhook_token");

CREATE INDEX IF NOT EXISTS "portal_webhooks_portal_name_idx"
  ON "portal_webhooks" ("portal_name");
