import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    workEmail: text("work_email"),
    workPhone: text("work_phone"),
    personalPhone: text("personal_phone"),
    homeLocation: text("home_location"),
    department: text("department"),
    designation: text("designation"),
    timeZone: text("time_zone"),
    brokerNumber: text("broker_number"),
    description: text("description"),
    roleLabel: text("role_label"),
    generalManagerId: uuid("general_manager_id").references((): AnyPgColumn => users.id),
    reportingToId: uuid("reporting_to_id").references((): AnyPgColumn => users.id),
    role: text("role").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("users_role_check", sql`${table.role} in ('admin', 'manager', 'agent')`),
    index("users_username_idx").on(table.username),
    index("users_org_id_idx").on(table.orgId),
    index("users_general_manager_id_idx").on(table.generalManagerId),
    index("users_reporting_to_id_idx").on(table.reportingToId),
  ],
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
    projectId: uuid("project_id").references(() => projects.id),
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
    index("leads_project_id_idx").on(table.projectId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("new"),
    projectType: text("project_type").notNull(),
    subType: text("sub_type"),
    availability: boolean("availability").notNull().default(true),
    facing: text("facing").array(),
    landArea: text("land_area"),
    certificate: text("certificate"),
    description: text("description"),
    notes: text("notes"),
    builderName: text("builder_name"),
    builderPhone: text("builder_phone"),
    builderContactName: text("builder_contact_name"),
    builderContactPhone: text("builder_contact_phone"),
    reraNumbers: text("rera_numbers").array(),
    minPrice: numeric("min_price", { precision: 14, scale: 2 }),
    maxPrice: numeric("max_price", { precision: 14, scale: 2 }),
    brokeragePercent: numeric("brokerage_percent", { precision: 5, scale: 2 }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    possessionDate: date("possession_date"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    projectCategory: text("project_category").notNull().default("residential"),
    unitsInfo: jsonb("units_info").$type<{
      units: Array<{
        type: string;
        count: number;
        carpetArea?: string;
        minPrice?: number;
        maxPrice?: number;
      }>;
    }>(),
    blocksInfo: jsonb("blocks_info").$type<{
      numberOfBlocks?: number;
      floorsPerBlock?: number;
      unitsPerFloor?: number;
      notes?: string;
    }>(),
    amenities: text("amenities").array(),
    gallery: jsonb("gallery").$type<{
      items: Array<{ id: string; name: string; placeholder?: boolean }>;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "projects_status_check",
      sql`${table.status} in ('new', 'pre_launch', 'launch', 'ongoing', 'completed')`,
    ),
    check(
      "projects_project_type_check",
      sql`${table.projectType} in ('residential', 'commercial', 'agricultural', 'plot', 'mixed')`,
    ),
    check(
      "projects_project_category_check",
      sql`${table.projectCategory} in ('residential', 'commercial', 'agricultural')`,
    ),
    index("projects_name_idx").on(table.name),
    index("projects_status_idx").on(table.status),
    index("projects_project_category_idx").on(table.projectCategory),
    index("projects_assigned_to_idx").on(table.assignedTo),
    index("projects_org_id_idx").on(table.orgId),
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

export const adLeads = pgTable(
  "ad_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    externalLeadId: text("external_lead_id").notNull(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ad_leads_source_external_lead_id_unique").on(table.source, table.externalLeadId),
    index("ad_leads_lead_id_idx").on(table.leadId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
    index("notifications_user_id_unread_idx").on(table.userId, table.isRead),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const integrationSyncState = pgTable("integration_sync_state", {
  integration: text("integration").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const userRolesRelations = relations(userRoles, () => ({}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  leads: many(leads),
  projects: many(projects),
  callRecords: many(callRecords),
  leadActivities: many(leadActivities),
  integrationSyncState: many(integrationSyncState),
}));

export const integrationSyncStateRelations = relations(integrationSyncState, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrationSyncState.orgId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  assignedLeads: many(leads),
  assignedProjects: many(projects),
  callRecords: many(callRecords),
  leadActivities: many(leadActivities),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
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
  project: one(projects, {
    fields: [leads.projectId],
    references: [projects.id],
  }),
  callRecords: many(callRecords),
  activities: many(leadActivities),
  consents: many(tcfConsents),
  adLeads: many(adLeads),
}));

export const adLeadsRelations = relations(adLeads, ({ one }) => ({
  lead: one(leads, {
    fields: [adLeads.leadId],
    references: [leads.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  assignee: one(users, {
    fields: [projects.assignedTo],
    references: [users.id],
  }),
  leads: many(leads),
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
