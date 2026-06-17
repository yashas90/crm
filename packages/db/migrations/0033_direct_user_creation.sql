ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_first_login" boolean NOT NULL DEFAULT true;

UPDATE "users" SET "is_first_login" = false WHERE "password_hash" IS NOT NULL;

DROP TABLE IF EXISTS "user_invites" CASCADE;
