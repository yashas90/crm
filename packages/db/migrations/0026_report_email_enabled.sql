ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "report_email_enabled" boolean DEFAULT true NOT NULL;
