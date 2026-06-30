CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "leads_first_name_trgm_idx"
  ON "leads" USING gin ("first_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "leads_last_name_trgm_idx"
  ON "leads" USING gin ("last_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "leads_email_trgm_idx"
  ON "leads" USING gin ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "leads_phone_trgm_idx"
  ON "leads" USING gin ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "leads_full_name_trgm_idx"
  ON "leads" USING gin ((coalesce("first_name", '') || ' ' || coalesce("last_name", '')) gin_trgm_ops);
