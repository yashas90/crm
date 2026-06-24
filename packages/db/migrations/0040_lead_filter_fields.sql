ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "sub_status" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_type" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_sub_type" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "bhk" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "bhk_type" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_status" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "locality" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "zone" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "min_budget" numeric(14, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "max_budget" numeric(14, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "carpet_area_sqft" numeric(12, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "built_up_area_sqft" numeric(12, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);

CREATE INDEX IF NOT EXISTS "leads_org_id_city_idx" ON "leads" ("org_id", "city");
CREATE INDEX IF NOT EXISTS "leads_org_id_locality_idx" ON "leads" ("org_id", "locality");
CREATE INDEX IF NOT EXISTS "leads_org_id_sub_status_idx" ON "leads" ("org_id", "sub_status");
