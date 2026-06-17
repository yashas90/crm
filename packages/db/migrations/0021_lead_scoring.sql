ALTER TABLE "leads" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsapp_replied_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "leads_score_idx" ON "leads" ("score");
