CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_key" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size_mb" numeric(10, 3) NOT NULL,
	"project_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_file_type_check" CHECK ("file_type" in ('pdf', 'image', 'other'))
);
--> statement-breakpoint
CREATE TABLE "lead_document_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_via" text NOT NULL,
	"share_token" text NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	CONSTRAINT "lead_document_shares_shared_via_check" CHECK ("shared_via" in ('whatsapp', 'email', 'link')),
	CONSTRAINT "lead_document_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_document_shares" ADD CONSTRAINT "lead_document_shares_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_document_shares" ADD CONSTRAINT "lead_document_shares_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_document_shares" ADD CONSTRAINT "lead_document_shares_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_document_shares" ADD CONSTRAINT "lead_document_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "documents_org_id_idx" ON "documents" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX "documents_project_id_idx" ON "documents" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "documents_uploaded_by_idx" ON "documents" USING btree ("uploaded_by");
--> statement-breakpoint
CREATE INDEX "documents_is_global_idx" ON "documents" USING btree ("is_global");
--> statement-breakpoint
CREATE INDEX "lead_document_shares_lead_id_idx" ON "lead_document_shares" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX "lead_document_shares_document_id_idx" ON "lead_document_shares" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "lead_document_shares_share_token_idx" ON "lead_document_shares" USING btree ("share_token");
