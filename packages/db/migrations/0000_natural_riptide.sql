CREATE TABLE "call_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lead_id" uuid,
	"phone_number" text NOT NULL,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer NOT NULL,
	"disposition" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_records_direction_check" CHECK ("call_records"."direction" in ('incoming', 'outgoing')),
	CONSTRAINT "call_records_status_check" CHECK ("call_records"."status" in ('completed', 'missed', 'rejected', 'failed')),
	CONSTRAINT "call_records_source_check" CHECK ("call_records"."source" in ('mobile-manual', 'mobile-auto'))
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_activities_type_check" CHECK ("lead_activities"."type" in ('call', 'note', 'status_change', 'meeting', 'task'))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assigned_to" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"secondary_phone" text,
	"city" text,
	"state" text,
	"lead_source" text,
	"lead_status" text DEFAULT 'new' NOT NULL,
	"temperature" text,
	"notes" text,
	"tags" text[],
	"custom_fields" jsonb,
	"last_contacted_at" timestamp with time zone,
	"next_followup_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "leads_lead_status_check" CHECK ("leads"."lead_status" in ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost')),
	CONSTRAINT "leads_temperature_check" CHECK ("leads"."temperature" in ('cold', 'warm', 'hot'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_tier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tcf_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"consent_type" text NOT NULL,
	"consented" boolean NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"source" text,
	"ip_address" text,
	CONSTRAINT "tcf_consents_consent_type_check" CHECK ("tcf_consents"."consent_type" in ('call', 'sms', 'email'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('admin', 'manager', 'agent'))
);
--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tcf_consents" ADD CONSTRAINT "tcf_consents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_records_org_user_started_at_idx" ON "call_records" USING btree ("org_id","user_id","started_at");--> statement-breakpoint
CREATE INDEX "call_records_org_lead_id_idx" ON "call_records" USING btree ("org_id","lead_id");--> statement-breakpoint
CREATE INDEX "call_records_phone_number_idx" ON "call_records" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_org_id_idx" ON "leads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leads_org_id_assigned_to_idx" ON "leads" USING btree ("org_id","assigned_to");--> statement-breakpoint
CREATE INDEX "leads_org_id_lead_status_idx" ON "leads" USING btree ("org_id","lead_status");--> statement-breakpoint
CREATE INDEX "leads_org_id_phone_idx" ON "leads" USING btree ("org_id","phone");