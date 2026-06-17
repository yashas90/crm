ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_name" text;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;
