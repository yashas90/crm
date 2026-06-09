-- Extend projects from simple name/location catalog to full property-project schema.

ALTER TABLE "projects" DROP COLUMN IF EXISTS "location";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "is_active";

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_type" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "sub_type" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "availability" boolean DEFAULT true NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "facing" text[];
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "builder_name" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "builder_contact_name" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "builder_contact_phone" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "rera_numbers" text[];
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "min_price" numeric(14, 2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "max_price" numeric(14, 2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "brokerage_percent" numeric(5, 2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "possession_date" date;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "assigned_to" uuid REFERENCES "users"("id");
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_category" text DEFAULT 'residential' NOT NULL;

UPDATE "projects"
SET
  "project_type" = COALESCE("project_type", 'residential'),
  "project_category" = COALESCE("project_category", 'residential'),
  "status" = COALESCE("status", 'new'),
  "availability" = COALESCE("availability", true)
WHERE "project_type" IS NULL
   OR "project_category" IS NULL
   OR "status" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "project_type" SET NOT NULL;

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_status_check";
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check"
  CHECK ("status" IN ('new', 'pre_launch', 'launch', 'ongoing', 'completed'));

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_project_type_check";
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_check"
  CHECK ("project_type" IN ('residential', 'commercial', 'agricultural', 'plot', 'mixed'));

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_project_category_check";
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_category_check"
  CHECK ("project_category" IN ('residential', 'commercial', 'agricultural'));

CREATE INDEX IF NOT EXISTS "projects_name_idx" ON "projects" ("name");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");
CREATE INDEX IF NOT EXISTS "projects_project_category_idx" ON "projects" ("project_category");
CREATE INDEX IF NOT EXISTS "projects_assigned_to_idx" ON "projects" ("assigned_to");
