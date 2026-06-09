CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "location" text,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_org_name_unique"
  ON "projects" ("org_id", lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "projects_org_id_idx" ON "projects" ("org_id");

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id");

CREATE INDEX IF NOT EXISTS "leads_project_id_idx" ON "leads" ("project_id");

INSERT INTO "projects" ("org_id", "name", "is_active")
SELECT DISTINCT l."org_id", l."project_name", true
FROM "leads" l
WHERE l."project_name" IS NOT NULL
  AND trim(l."project_name") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "projects" p
    WHERE p."org_id" = l."org_id"
      AND lower(p."name") = lower(trim(l."project_name"))
      AND p."deleted_at" IS NULL
  );

UPDATE "leads" l
SET "project_id" = p."id"
FROM "projects" p
WHERE l."project_id" IS NULL
  AND l."project_name" IS NOT NULL
  AND lower(trim(l."project_name")) = lower(p."name")
  AND l."org_id" = p."org_id"
  AND l."deleted_at" IS NULL
  AND p."deleted_at" IS NULL;
