ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "category" TEXT;

CREATE INDEX IF NOT EXISTS "documents_is_public_idx" ON "documents" ("is_public");
CREATE INDEX IF NOT EXISTS "documents_project_public_idx" ON "documents" ("project_id", "is_public");
