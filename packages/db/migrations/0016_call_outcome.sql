ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "outcome" text;

ALTER TABLE "call_records" DROP CONSTRAINT IF EXISTS "call_records_source_check";
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_source_check"
  CHECK ("source" in ('mobile-manual', 'mobile-auto', 'web-manual'));
