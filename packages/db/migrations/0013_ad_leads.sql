CREATE TABLE IF NOT EXISTS "ad_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "external_lead_id" text NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id"),
  "raw_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_leads_source_external_lead_id_unique"
  ON "ad_leads" ("source", "external_lead_id");

CREATE INDEX IF NOT EXISTS "ad_leads_lead_id_idx" ON "ad_leads" ("lead_id");
