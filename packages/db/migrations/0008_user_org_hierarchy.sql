ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "general_manager_id" uuid REFERENCES "users"("id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reporting_to_id" uuid REFERENCES "users"("id");

CREATE INDEX IF NOT EXISTS "users_general_manager_id_idx" ON "users" ("general_manager_id");
CREATE INDEX IF NOT EXISTS "users_reporting_to_id_idx" ON "users" ("reporting_to_id");
