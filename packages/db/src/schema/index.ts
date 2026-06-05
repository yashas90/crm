import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  subscriptionTier: text("subscription_tier").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("users_role_check", sql`${table.role} in ('admin', 'manager', 'agent')`)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    secondaryPhone: text("secondary_phone"),
    city: text("city"),
    state: text("state"),
    leadSource: text("lead_source"),
    projectName: text("project_name"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
    leadStatus: text("lead_status").notNull().default("new"),
    temperature: text("temperature"),
    notes: text("notes"),
    tags: text("tags").array(),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "leads_lead_status_check",
      sql`${table.leadStatus} in ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost')`,
    ),
    check("leads_temperature_check", sql`${table.temperature} in ('cold', 'warm', 'hot')`),
    index("leads_org_id_idx").on(table.orgId),
    index("leads_org_id_assigned_to_idx").on(table.orgId, table.assignedTo),
    index("leads_org_id_lead_status_idx").on(table.orgId, table.leadStatus),
    index("leads_org_id_phone_idx").on(table.orgId, table.phone),
  ],
);

export const callRecords = pgTable(
  "call_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    leadId: uuid("lead_id").references(() => leads.id),
    phoneNumber: text("phone_number").notNull(),
    direction: text("direction").notNull(),
    status: text("status").notNull(),
    source: text("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull(),
    disposition: text("disposition"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("call_records_direction_check", sql`${table.direction} in ('incoming', 'outgoing')`),
    check(
      "call_records_status_check",
      sql`${table.status} in ('completed', 'missed', 'rejected', 'failed')`,
    ),
    check("call_records_source_check", sql`${table.source} in ('mobile-manual', 'mobile-auto')`),
    index("call_records_org_user_started_at_idx").on(table.orgId, table.userId, table.startedAt),
    index("call_records_org_lead_id_idx").on(table.orgId, table.leadId),
    index("call_records_phone_number_idx").on(table.phoneNumber),
  ],
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").references(() => users.id),
    type: text("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "lead_activities_type_check",
      sql`${table.type} in ('call', 'note', 'status_change', 'meeting', 'task')`,
    ),
    index("lead_activities_lead_id_created_at_idx").on(table.leadId, table.createdAt.desc()),
  ],
);

export const tcfConsents = pgTable(
  "tcf_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    consentType: text("consent_type").notNull(),
    consented: boolean("consented").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    source: text("source"),
    ipAddress: text("ip_address"),
  },
  (table) => [
    check("tcf_consents_consent_type_check", sql`${table.consentType} in ('call', 'sms', 'email')`),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  leads: many(leads),
  callRecords: many(callRecords),
  leadActivities: many(leadActivities),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  assignedLeads: many(leads),
  callRecords: many(callRecords),
  leadActivities: many(leadActivities),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leads.orgId],
    references: [organizations.id],
  }),
  assignee: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
  }),
  callRecords: many(callRecords),
  activities: many(leadActivities),
  consents: many(tcfConsents),
}));

export const callRecordsRelations = relations(callRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [callRecords.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [callRecords.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [callRecords.leadId],
    references: [leads.id],
  }),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  organization: one(organizations, {
    fields: [leadActivities.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [leadActivities.userId],
    references: [users.id],
  }),
}));

export const tcfConsentsRelations = relations(tcfConsents, ({ one }) => ({
  lead: one(leads, {
    fields: [tcfConsents.leadId],
    references: [leads.id],
  }),
}));
