CREATE TABLE IF NOT EXISTS "booking_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"lead_id" uuid,
	"agent_id" uuid,
	"file_key" text NOT NULL,
	"file_url" text NOT NULL,
	"booking_ref" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_documents_unit_id_project_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."project_units"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "booking_documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "booking_documents_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_documents_unit_id_idx" ON "booking_documents" USING btree ("unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_documents_generated_at_idx" ON "booking_documents" USING btree ("generated_at");
