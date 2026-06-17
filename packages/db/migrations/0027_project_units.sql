CREATE TABLE IF NOT EXISTS "project_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"unit_number" text NOT NULL,
	"floor" integer NOT NULL,
	"bedrooms" integer NOT NULL,
	"area_sq_ft" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"price_listed_rs" bigint NOT NULL,
	"price_final_rs" bigint,
	"assigned_lead_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "project_units_assigned_lead_id_leads_id_fk" FOREIGN KEY ("assigned_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "project_units_status_check" CHECK ("status" in ('available', 'reserved', 'booked', 'sold')),
	CONSTRAINT "project_units_bedrooms_check" CHECK ("bedrooms" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_units_project_unit_number_idx" ON "project_units" USING btree ("project_id","unit_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_units_project_id_idx" ON "project_units" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_units_status_idx" ON "project_units" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_units_assigned_lead_id_idx" ON "project_units" USING btree ("assigned_lead_id");
