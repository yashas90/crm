ALTER TABLE "leads" ADD COLUMN "follow_up_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cold_since" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "leads_next_followup_at_idx" ON "leads" USING btree ("next_followup_at");
--> statement-breakpoint
CREATE INDEX "leads_last_contacted_at_idx" ON "leads" USING btree ("last_contacted_at");
--> statement-breakpoint
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_type_check";
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_type_check" CHECK ("type" in ('call', 'note', 'status_change', 'meeting', 'task', 'follow_up'));
