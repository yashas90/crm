CREATE TABLE "whatsapp_blast_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"media_url" text,
	"media_type" text,
	"buttons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question_flow" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thank_you_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_templates" ADD CONSTRAINT "whatsapp_blast_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_templates" ADD CONSTRAINT "whatsapp_blast_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "whatsapp_blast_templates_org_id_idx" ON "whatsapp_blast_templates" ("org_id");
--> statement-breakpoint
CREATE TABLE "whatsapp_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"campaign_code" text NOT NULL,
	"name" text NOT NULL,
	"property_id" uuid,
	"property_name" text,
	"template_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_agent_id" uuid,
	"sending_speed" text DEFAULT 'safe' NOT NULL,
	"daily_limit" integer DEFAULT 500 NOT NULL,
	"sent_today" integer DEFAULT 0 NOT NULL,
	"sent_today_date" date,
	"last_sent_at" timestamp with time zone,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"replied_count" integer DEFAULT 0 NOT NULL,
	"interested_count" integer DEFAULT 0 NOT NULL,
	"not_interested_count" integer DEFAULT 0 NOT NULL,
	"leads_generated" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_property_id_projects_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_template_id_whatsapp_blast_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_blast_templates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_status_check" CHECK ("status" in ('draft', 'scheduled', 'running', 'paused', 'completed'));
--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_speed_check" CHECK ("sending_speed" in ('safe', 'normal', 'fast'));
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_campaigns_org_code_uidx" ON "whatsapp_campaigns" ("org_id","campaign_code");
--> statement-breakpoint
CREATE INDEX "whatsapp_campaigns_org_status_idx" ON "whatsapp_campaigns" ("org_id","status");
--> statement-breakpoint
CREATE TABLE "whatsapp_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"budget" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"invalid_reason" text,
	"interest_clicked_at" timestamp with time zone,
	"question_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_question_id" text,
	"flow_completed_at" timestamp with time zone,
	"lead_id" uuid,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"last_wa_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_campaign_id_whatsapp_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."whatsapp_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_status_check" CHECK ("status" in ('pending', 'queued', 'sent', 'delivered', 'read', 'replied', 'interested', 'not_interested', 'invalid'));
--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_campaign_idx" ON "whatsapp_contacts" ("campaign_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_phone_idx" ON "whatsapp_contacts" ("org_id","phone");
--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_campaign_status_idx" ON "whatsapp_contacts" ("campaign_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_contacts_campaign_phone_uidx" ON "whatsapp_contacts" ("campaign_id","phone");
--> statement-breakpoint
CREATE TABLE "whatsapp_blast_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"campaign_id" uuid,
	"contact_id" uuid,
	"wa_message_id" text,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"failed_reason" text,
	"lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_campaign_id_whatsapp_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."whatsapp_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_contact_id_whatsapp_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."whatsapp_contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_direction_check" CHECK ("direction" in ('outbound', 'inbound'));
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_type_check" CHECK ("type" in ('template', 'text', 'button_reply', 'media'));
--> statement-breakpoint
ALTER TABLE "whatsapp_blast_messages" ADD CONSTRAINT "whatsapp_blast_messages_status_check" CHECK ("status" in ('queued', 'sent', 'delivered', 'read', 'failed'));
--> statement-breakpoint
CREATE INDEX "whatsapp_blast_messages_contact_idx" ON "whatsapp_blast_messages" ("contact_id","created_at");
--> statement-breakpoint
CREATE INDEX "whatsapp_blast_messages_wa_id_idx" ON "whatsapp_blast_messages" ("wa_message_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_blast_messages_campaign_idx" ON "whatsapp_blast_messages" ("campaign_id");
--> statement-breakpoint
CREATE TABLE "whatsapp_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_code" text NOT NULL,
	"campaign_id" uuid,
	"contact_id" uuid,
	"contact_phone" text NOT NULL,
	"name" text NOT NULL,
	"budget_answer" text,
	"location_answer" text,
	"timeline_answer" text,
	"all_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_campaign" text,
	"property_name" text,
	"assigned_agent_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"converted_to_lead_id" uuid,
	"interest_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_campaign_id_whatsapp_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."whatsapp_campaigns"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_contact_id_whatsapp_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."whatsapp_contacts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_converted_to_lead_id_leads_id_fk" FOREIGN KEY ("converted_to_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_status_check" CHECK ("status" in ('new', 'contacted', 'converted', 'lost'));
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_leads_org_code_uidx" ON "whatsapp_leads" ("org_id","lead_code");
--> statement-breakpoint
CREATE INDEX "whatsapp_leads_org_status_idx" ON "whatsapp_leads" ("org_id","status");
--> statement-breakpoint
CREATE INDEX "whatsapp_leads_campaign_idx" ON "whatsapp_leads" ("campaign_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_leads_phone_idx" ON "whatsapp_leads" ("org_id","contact_phone");
