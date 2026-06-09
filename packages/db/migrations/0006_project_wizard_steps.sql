ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "units_info" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "blocks_info" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "amenities" text[];
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gallery" jsonb;
