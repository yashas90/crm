CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL
);

INSERT INTO "user_roles" ("name", "permissions") VALUES
  (
    'Basic',
    '["master_data:search","dashboard:view","dashboard:view_team","users:view_for_filter","user_profile:view","user_profile:update","leads:view","leads:search","leads:create","leads:update","leads:assign","leads:view_lead_source","leads:update_basic_info","leads:update_lead_status","leads:update_notes","reports:view","reports:view_reportees"]'::jsonb
  ),
  (
    'Admin',
    '["*"]'::jsonb
  ),
  (
    'Manager',
    '["master_data:search","dashboard:view","dashboard:view_team","users:view","users:search","users:create","users:update","users:delete","users:view_for_filter","user_profile:view","user_profile:update","user_roles:view","user_roles:update","leads:view","leads:search","leads:create","leads:update","leads:delete","leads:assign","leads:view_all","reports:view","reports:view_all","reports:export","org_profile:view","org_profile:update"]'::jsonb
  )
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "work_email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "work_phone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_phone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "home_location" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designation" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "time_zone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "broker_number" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_label" text;

UPDATE "users"
SET
  "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9._-]', '', 'g')),
  "first_name" = split_part("name", ' ', 1),
  "last_name" = nullif(trim(substring("name" from position(' ' in "name") + 1)), ''),
  "work_email" = "email",
  "work_phone" = "phone",
  "role_label" = CASE
    WHEN "role" = 'admin' THEN 'Admin'
    WHEN "role" = 'manager' THEN 'Manager'
    ELSE 'Basic'
  END
WHERE "username" IS NULL;

UPDATE "users" u
SET "username" = u."username" || '_' || left(u."id"::text, 8)
WHERE u."id" IN (
  SELECT u2."id"
  FROM "users" u2
  INNER JOIN (
    SELECT "username", count(*) AS cnt
    FROM "users"
    GROUP BY "username"
    HAVING count(*) > 1
  ) dup ON u2."username" = dup."username"
);

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique_idx" ON "users" ("username");
CREATE INDEX IF NOT EXISTS "users_org_id_idx" ON "users" ("org_id");
