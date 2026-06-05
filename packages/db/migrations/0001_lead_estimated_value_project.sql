ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "estimated_value" numeric(14, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_name" text;
