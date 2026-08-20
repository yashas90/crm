import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
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
    isFirstLogin: boolean("is_first_login").notNull().default(true),
    sessionsRevokedAt: timestamp("sessions_revoked_at", { withTimezone: true }),
    reportEmailEnabled: boolean("report_email_enabled").notNull().default(true),
    trackingPolicyEnabled: boolean("tracking_policy_enabled").notNull().default(true),
    expoPushToken: text("expo_push_token"),
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
    subStatus: text("sub_status"),
    locality: text("locality"),
    country: text("country"),
    zone: text("zone"),
    propertyType: text("property_type"),
    propertySubType: text("property_sub_type"),
    bhk: text("bhk"),
    bhkType: text("bhk_type"),
    propertyStatus: text("property_status"),
    minBudget: numeric("min_budget", { precision: 14, scale: 2 }),
    maxBudget: numeric("max_budget", { precision: 14, scale: 2 }),
    carpetAreaSqft: numeric("carpet_area_sqft", { precision: 12, scale: 2 }),
    builtUpAreaSqft: numeric("built_up_area_sqft", { precision: 12, scale: 2 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
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
    followUpCount: integer("follow_up_count").notNull().default(0),
    coldSince: timestamp("cold_since", { withTimezone: true }),
    score: integer("score").notNull().default(0),
    scoreUpdatedAt: timestamp("score_updated_at", { withTimezone: true }),
    whatsappRepliedAt: timestamp("whatsapp_replied_at", { withTimezone: true }),
    closeReason: text("close_reason"),
    closeReasonNote: text("close_reason_note"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    /** When the lead entered NA (not_interested / dropped). Used for 1-week hard-delete. */
    naSinceAt: timestamp("na_since_at", { withTimezone: true }),
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    projectId: uuid("project_id").references(() => projects.id),
  },
  (table) => [
    check(
      "leads_lead_status_check",
      sql`${table.leadStatus} in ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost', 'not_interested', 'dropped')`,
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
      items: Array<{
        id: string;
        name: string;
        url?: string;
        fileKey?: string;
        mimeType?: string;
        placeholder?: boolean;
      }>;
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
    outcome: text("outcome"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("call_records_direction_check", sql`${table.direction} in ('incoming', 'outgoing')`),
    check(
      "call_records_status_check",
      sql`${table.status} in ('completed', 'missed', 'rejected', 'failed')`,
    ),
    check(
      "call_records_source_check",
      sql`${table.source} in ('mobile-manual', 'mobile-auto', 'web-manual')`,
    ),
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
      sql`${table.type} in ('call', 'note', 'status_change', 'meeting', 'task', 'follow_up', 'assignment_change', 'site_visit')`,
    ),
    index("lead_activities_lead_id_created_at_idx").on(table.leadId, table.createdAt.desc()),
    index("lead_activities_org_id_idx").on(table.orgId),
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
    entityName: text("entity_name"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const integrationSyncState = pgTable(
  "integration_sync_state",
  {
    integration: text("integration").primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("integration_sync_state_integration_org_id_idx").on(table.integration, table.orgId),
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
    index("tcf_consents_lead_id_idx").on(table.leadId),
  ],
);

export const projectUnits = pgTable(
  "project_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    unitNumber: text("unit_number").notNull(),
    floor: integer("floor").notNull(),
    bedrooms: integer("bedrooms").notNull(),
    areaSqFt: numeric("area_sq_ft", { precision: 10, scale: 2 }).notNull(),
    status: text("status").notNull().default("available"),
    priceListedRs: bigint("price_listed_rs", { mode: "number" }).notNull(),
    priceFinalRs: bigint("price_final_rs", { mode: "number" }),
    assignedLeadId: uuid("assigned_lead_id").references(() => leads.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "project_units_status_check",
      sql`${table.status} in ('available', 'reserved', 'booked', 'sold')`,
    ),
    check("project_units_bedrooms_check", sql`${table.bedrooms} in (1, 2, 3, 4)`),
    uniqueIndex("project_units_project_unit_number_idx").on(table.projectId, table.unitNumber),
    index("project_units_project_id_idx").on(table.projectId),
    index("project_units_status_idx").on(table.status),
    index("project_units_assigned_lead_id_idx").on(table.assignedLeadId),
  ],
);

export const bookingDocuments = pgTable(
  "booking_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => projectUnits.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url").notNull(),
    bookingRef: text("booking_ref").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("booking_documents_unit_id_idx").on(table.unitId),
    index("booking_documents_generated_at_idx").on(table.generatedAt),
  ],
);

export const portalWebhooks = pgTable(
  "portal_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portalName: text("portal_name").notNull(),
    webhookToken: uuid("webhook_token").notNull().defaultRandom().unique(),
    fieldMapping: jsonb("field_mapping").$type<Record<string, string>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    lastLeadReceivedAt: timestamp("last_lead_received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "portal_webhooks_portal_name_check",
      sql`${table.portalName} in ('99acres', 'magicbricks', 'housing', 'indiamrt', 'other')`,
    ),
    index("portal_webhooks_portal_name_idx").on(table.portalName),
  ],
);

export const agentTargets = pgTable(
  "agent_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    month: text("month").notNull(),
    targetCalls: integer("target_calls").notNull().default(0),
    targetSiteVisits: integer("target_site_visits").notNull().default(0),
    targetBookings: integer("target_bookings").notNull().default(0),
    targetRevenue: numeric("target_revenue", { precision: 16, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_targets_user_month_idx").on(table.orgId, table.userId, table.month),
    index("agent_targets_org_month_idx").on(table.orgId, table.month),
  ],
);

/** Background location pings from the mobile app (09:30–20:30 IST Mon–Sun). */
export const agentLocations = pgTable(
  "agent_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id"),
    deviceId: text("device_id"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracy: doublePrecision("accuracy"),
    batteryLevel: integer("battery_level"),
    networkStatus: text("network_status"),
    source: text("source").default("mobile_background"),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    altitude: doublePrecision("altitude"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_agent_locations_user_captured").on(table.userId, table.capturedAt),
    index("idx_agent_locations_captured").on(table.capturedAt),
    uniqueIndex("idx_agent_locations_user_event").on(table.userId, table.eventId),
  ],
);

/** Registered field devices for tracking permission / heartbeat status. */
export const agentDevices = pgTable(
  "agent_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    platform: text("platform").notNull(),
    appVersion: text("app_version"),
    installationId: text("installation_id"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    osVersion: text("os_version"),
    locationPermissionStatus: text("location_permission_status"),
    callLogPermissionStatus: text("call_log_permission_status"),
    trackingEnabled: boolean("tracking_enabled").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
    lastCallLogSyncAt: timestamp("last_call_log_sync_at", { withTimezone: true }),
    lastKnownLatitude: doublePrecision("last_known_latitude"),
    lastKnownLongitude: doublePrecision("last_known_longitude"),
    lastKnownAccuracy: doublePrecision("last_known_accuracy"),
    lastKnownCapturedAt: timestamp("last_known_captured_at", { withTimezone: true }),
    deviceStatus: text("device_status").notNull().default("UNKNOWN"),
    healthStatus: text("health_status").notNull().default("UNKNOWN"),
    isCurrent: boolean("is_current").notNull().default(true),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    batteryLevel: integer("battery_level"),
    networkStatus: text("network_status"),
    mdmEnrolled: boolean("mdm_enrolled"),
    mdmCompliant: boolean("mdm_compliant"),
    mdmAppInstalled: boolean("mdm_app_installed"),
    mdmLastCheckInAt: timestamp("mdm_last_check_in_at", { withTimezone: true }),
    mdmManagedStatus: text("mdm_managed_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_agent_devices_user_device").on(table.userId, table.deviceId),
    index("idx_agent_devices_user_seen").on(table.userId, table.lastSeenAt),
    index("idx_agent_devices_health").on(table.healthStatus, table.lastSeenAt),
    index("idx_agent_devices_user_current").on(table.userId, table.isCurrent),
  ],
);

/** Org-level tracking schedule / thresholds (overrides env defaults when present). */
export const trackingSettings = pgTable(
  "tracking_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    startTime: text("start_time").notNull().default("09:30"),
    endTime: text("end_time").notNull().default("20:30"),
    intervalMinutes: integer("interval_minutes").notNull().default(30),
    retentionDays: integer("retention_days").notNull().default(14),
    missingAlertMinutes: integer("missing_alert_minutes").notNull().default(75),
    heartbeatThresholdMinutes: integer("heartbeat_threshold_minutes").notNull().default(60),
    possibleUninstallMinutes: integer("possible_uninstall_minutes").notNull().default(180),
    activeDays: integer("active_days").array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_tracking_settings_org").on(table.orgId)],
);

/** Admin-facing tracking health alerts (deduped while open). */
export const trackingAlerts = pgTable(
  "tracking_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id"),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull().default("WARNING"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    isResolved: boolean("is_resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tracking_alerts_org_created").on(table.orgId, table.createdAt),
    index("idx_tracking_alerts_agent_open").on(table.agentId, table.isResolved, table.createdAt),
    index("idx_tracking_alerts_type_open").on(table.alertType, table.isResolved),
  ],
);

/** Retention cleanup job audit (counts only — no deleted row payloads). */
export const trackingCleanupRuns = pgTable(
  "tracking_cleanup_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: text("job_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    locationRecordsDeleted: integer("location_records_deleted").notNull().default(0),
    callLogRecordsDeleted: integer("call_log_records_deleted").notNull().default(0),
    temporaryRecordsDeleted: integer("temporary_records_deleted").notNull().default(0),
    status: text("status").notNull().default("running"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_tracking_cleanup_runs_started").on(table.startedAt)],
);

/**
 * OS call-log metadata sync (Android when permitted).
 * Separate from CRM `call_records` (lead-linked dialer logs).
 */
export const agentCallLogs = pgTable(
  "agent_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    callLogId: text("call_log_id"),
    phoneNumber: text("phone_number"),
    callType: text("call_type").notNull(),
    callStartTime: timestamp("call_start_time", { withTimezone: true }).notNull(),
    callEndTime: timestamp("call_end_time", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_agent_call_logs_user_event").on(table.userId, table.eventId),
    index("idx_agent_call_logs_user_start").on(table.userId, table.callStartTime),
    index("idx_agent_call_logs_start").on(table.callStartTime),
  ],
);

export const trackingAuditLogs = pgTable(
  "tracking_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_tracking_audit_admin_created").on(table.adminId, table.createdAt)],
);

export const leadAssignmentRules = pgTable(
  "lead_assignment_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    strategy: text("strategy").notNull().default("round_robin"),
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull().default({}),
    assigneeIds: text("assignee_ids").array().notNull().default([]),
    priority: integer("priority").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_assignment_rules_org_id_idx").on(table.orgId, table.isActive)],
);

export const assignmentRuleState = pgTable("assignment_rule_state", {
  ruleId: uuid("rule_id")
    .primaryKey()
    .references(() => leadAssignmentRules.id, { onDelete: "cascade" }),
  lastAssignedIndex: integer("last_assigned_index").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id").references(() => leads.id),
    sentBy: uuid("sent_by")
      .notNull()
      .references(() => users.id),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("sent"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("email_logs_lead_id_idx").on(table.leadId),
    index("email_logs_org_id_idx").on(table.orgId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id").references(() => leads.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("pending"),
    taskType: text("task_type").notNull().default("follow_up"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("tasks_priority_check", sql`${table.priority} in ('low', 'medium', 'high', 'urgent')`),
    check(
      "tasks_status_check",
      sql`${table.status} in ('pending', 'in_progress', 'completed', 'cancelled')`,
    ),
    check(
      "tasks_task_type_check",
      sql`${table.taskType} in ('call', 'meeting', 'follow_up', 'document', 'site_visit', 'other')`,
    ),
    index("tasks_org_id_idx").on(table.orgId),
    index("tasks_lead_id_idx").on(table.leadId),
    index("tasks_assigned_to_idx").on(table.assignedTo),
    index("tasks_due_at_idx").on(table.dueAt),
    index("tasks_status_idx").on(table.status),
    index("tasks_org_status_due_at_idx").on(table.orgId, table.status, table.dueAt),
  ],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    position: integer("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    mapsToStatus: text("maps_to_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pipeline_stages_org_id_idx").on(table.orgId, table.position)],
);

export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope"),
  calendarId: text("calendar_id").notNull().default("primary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const agentLocationsRelations = relations(agentLocations, ({ one }) => ({
  user: one(users, {
    fields: [agentLocations.userId],
    references: [users.id],
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
  locations: many(agentLocations),
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
  tasks: many(tasks),
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

export const tokenBlocklist = pgTable(
  "token_blocklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jti: uuid("jti").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("token_blocklist_jti_idx").on(table.jti),
    index("token_blocklist_expires_at_idx").on(table.expiresAt),
  ],
);

export const passwordHistory = pgTable(
  "password_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("password_history_user_id_idx").on(table.userId, table.createdAt)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: uuid("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_unique").on(table.token),
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ],
);

export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    device: text("device").notNull(),
    locationCity: text("location_city"),
    locationCountry: text("location_country"),
    isNewDevice: boolean("is_new_device").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_events_user_id_idx").on(table.userId, table.createdAt)],
);

export const authRefreshSessions = pgTable(
  "auth_refresh_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_refresh_sessions_token_hash_idx").on(table.tokenHash),
    index("auth_refresh_sessions_user_id_idx").on(table.userId),
    index("auth_refresh_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const leadAssignments = pgTable(
  "lead_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    fromAgentId: uuid("from_agent_id").references(() => users.id, { onDelete: "set null" }),
    toAgentId: uuid("to_agent_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lead_assignments_lead_id_idx").on(table.leadId),
    index("lead_assignments_assigned_at_idx").on(table.assignedAt),
  ],
);

export const leadImportBatches = pgTable(
  "lead_import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name"),
    status: text("status").notNull().default("completed"),
    totalCount: integer("total_count").notNull().default(0),
    uniqueCount: integer("unique_count").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    invalidCount: integer("invalid_count").notNull().default(0),
    reportJson: jsonb("report_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "lead_import_batches_status_check",
      sql`${table.status} in ('initiated', 'completed', 'failed')`,
    ),
    index("lead_import_batches_org_id_created_at_idx").on(table.orgId, table.createdAt),
  ],
);

export const leadImportBatchItems = pgTable(
  "lead_import_batch_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => leadImportBatches.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    rowNumber: integer("row_number").notNull(),
    outcome: text("outcome").notNull(),
    phone: text("phone"),
    message: text("message"),
  },
  (table) => [
    check(
      "lead_import_batch_items_outcome_check",
      sql`${table.outcome} in ('created', 'updated', 'skipped', 'failed')`,
    ),
    uniqueIndex("lead_import_batch_items_batch_row_idx").on(table.batchId, table.rowNumber),
    index("lead_import_batch_items_batch_id_idx").on(table.batchId),
    index("lead_import_batch_items_lead_id_idx").on(table.leadId),
  ],
);

export const siteVisits = pgTable(
  "site_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    projectId: uuid("project_id").references(() => projects.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id),
    visitDate: date("visit_date").notNull(),
    visitTime: text("visit_time").notNull(),
    duration: integer("duration").notNull().default(60),
    status: text("status").notNull().default("scheduled"),
    outcome: text("outcome"),
    outcomeNote: text("outcome_note"),
    notes: text("notes"),
    propertyAddress: text("property_address"),
    unitId: uuid("unit_id").references(() => projectUnits.id, { onDelete: "set null" }),
    tower: text("tower"),
    mapsLink: text("maps_link"),
    meetingLocation: text("meeting_location"),
    customerEmail: text("customer_email"),
    publicToken: text("public_token").notNull(),
    googleCalendarEventId: text("google_calendar_event_id"),
    googleCalendarUserId: uuid("google_calendar_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reminderSent: boolean("reminder_sent").notNull().default(false),
    remindersSent: jsonb("reminders_sent")
      .$type<{ tierMinutes: number; sentAt: string }[]>()
      .notNull()
      .default([]),
    confirmedByClient: boolean("confirmed_by_client").notNull().default(false),
    confirmedByClientAt: timestamp("confirmed_by_client_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("site_visits_org_id_idx").on(table.orgId),
    index("site_visits_lead_id_idx").on(table.leadId),
    index("site_visits_agent_id_idx").on(table.agentId),
    index("site_visits_visit_date_idx").on(table.visitDate),
    uniqueIndex("site_visits_public_token_idx").on(table.publicToken),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: text("file_type").notNull(),
    fileSizeMb: numeric("file_size_mb", { precision: 10, scale: 3 }).notNull(),
    projectId: uuid("project_id").references(() => projects.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    originalName: text("original_name"),
    isGlobal: boolean("is_global").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(false),
    category: text("category"),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("documents_file_type_check", sql`${table.fileType} in ('pdf', 'image', 'other')`),
    check(
      "documents_category_check",
      sql`${table.category} is null or ${table.category} in ('brochure', 'floor_plan', 'price_list', 'other')`,
    ),
    index("documents_org_id_idx").on(table.orgId),
    index("documents_project_id_idx").on(table.projectId),
    index("documents_uploaded_by_idx").on(table.uploadedBy),
    index("documents_is_global_idx").on(table.isGlobal),
    index("documents_is_public_idx").on(table.isPublic),
  ],
);

export const leadDocumentShares = pgTable(
  "lead_document_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    sharedBy: uuid("shared_by")
      .notNull()
      .references(() => users.id),
    sharedVia: text("shared_via").notNull(),
    shareToken: text("share_token").notNull().unique(),
    sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "lead_document_shares_shared_via_check",
      sql`${table.sharedVia} in ('whatsapp', 'email', 'link')`,
    ),
    index("lead_document_shares_lead_id_idx").on(table.leadId),
    index("lead_document_shares_document_id_idx").on(table.documentId),
    index("lead_document_shares_share_token_idx").on(table.shareToken),
    index("lead_document_shares_expires_at_idx").on(table.expiresAt),
  ],
);

export const documentAccessEvents = pgTable(
  "document_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_access_events_doc_time_idx").on(table.documentId, table.accessedAt)],
);

export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    templateName: text("template_name").notNull(),
    language: text("language").notNull().default("en"),
    category: text("category").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("whatsapp_templates_org_template_lang_idx").on(
      table.orgId,
      table.templateName,
      table.language,
    ),
    index("whatsapp_templates_org_id_idx").on(table.orgId),
  ],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    sentBy: uuid("sent_by")
      .notNull()
      .references(() => users.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => whatsappTemplates.id),
    variables: jsonb("variables").$type<Record<string, unknown>>().notNull().default({}),
    waMessageId: text("wa_message_id"),
    status: text("status").notNull().default("sent"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
  },
  (table) => [
    index("whatsapp_messages_lead_id_idx").on(table.leadId),
    index("whatsapp_messages_wa_message_id_idx").on(table.waMessageId),
    index("whatsapp_messages_org_id_idx").on(table.orgId),
  ],
);

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("message_templates_org_id_idx").on(table.orgId),
    index("message_templates_org_active_idx").on(table.orgId, table.isActive),
    check(
      "message_templates_category_check",
      sql`${table.category} in ('greeting', 'project_details', 'follow_up', 'site_visit', 'custom')`,
    ),
  ],
);

export const securityAlerts = pgTable(
  "security_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    alertType: text("alert_type").notNull(),
    details: jsonb("details").notNull().default({}),
    ipAddress: text("ip_address"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_alerts_unresolved_idx").on(table.resolved, table.createdAt),
    index("security_alerts_user_id_idx").on(table.userId),
  ],
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, {
    fields: [tasks.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [tasks.leadId],
    references: [leads.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
}));

/* ─── Meta Business Integration ─────────────────────────────────────────── */

/** OAuth / system-user tokens for Meta Graph API. */
export const facebookTokens = pgTable(
  "facebook_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    metaUserId: text("meta_user_id"),
    tokenType: text("token_type").notNull().default("user"),
    /** AES-GCM encrypted access token (enc:v1:...). */
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    scopes: text("scopes").array(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    tokenDataAccessExpiresAt: timestamp("token_data_access_expires_at", { withTimezone: true }),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "facebook_tokens_token_type_check",
      sql`${table.tokenType} in ('user', 'page', 'system')`,
    ),
    check(
      "facebook_tokens_status_check",
      sql`${table.status} in ('active', 'expired', 'revoked', 'error')`,
    ),
    index("facebook_tokens_org_id_idx").on(table.orgId),
    index("facebook_tokens_status_idx").on(table.orgId, table.status),
  ],
);

export const facebookBusinesses = pgTable(
  "facebook_businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    tokenId: uuid("token_id").references(() => facebookTokens.id, { onDelete: "set null" }),
    businessId: text("business_id").notNull(),
    name: text("name").notNull(),
    verificationStatus: text("verification_status"),
    isActive: boolean("is_active").notNull().default(true),
    connectedBy: uuid("connected_by").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_businesses_org_business_id_uidx").on(table.orgId, table.businessId),
    index("facebook_businesses_org_id_idx").on(table.orgId),
  ],
);

export const facebookAccounts = pgTable(
  "facebook_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    businessId: uuid("business_id").references(() => facebookBusinesses.id, {
      onDelete: "set null",
    }),
    adAccountId: text("ad_account_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency"),
    timezoneName: text("timezone_name"),
    accountStatus: integer("account_status"),
    isSelected: boolean("is_selected").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_accounts_org_ad_account_uidx").on(table.orgId, table.adAccountId),
    index("facebook_accounts_org_id_idx").on(table.orgId),
    index("facebook_accounts_business_id_idx").on(table.businessId),
  ],
);

export const facebookPages = pgTable(
  "facebook_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    businessId: uuid("business_id").references(() => facebookBusinesses.id, {
      onDelete: "set null",
    }),
    pageId: text("page_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    accessTokenEncrypted: text("access_token_encrypted"),
    isSelected: boolean("is_selected").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    leadgenSubscribed: boolean("leadgen_subscribed").notNull().default(false),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_pages_org_page_id_uidx").on(table.orgId, table.pageId),
    index("facebook_pages_org_id_idx").on(table.orgId),
    index("facebook_pages_page_id_idx").on(table.pageId),
  ],
);

export const instagramAccounts = pgTable(
  "instagram_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    pageId: uuid("page_id").references(() => facebookPages.id, { onDelete: "cascade" }),
    igUserId: text("ig_user_id").notNull(),
    username: text("username"),
    name: text("name"),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("instagram_accounts_org_ig_user_uidx").on(table.orgId, table.igUserId),
    index("instagram_accounts_page_id_idx").on(table.pageId),
  ],
);

export const facebookForms = pgTable(
  "facebook_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    pageId: uuid("page_id")
      .notNull()
      .references(() => facebookPages.id, { onDelete: "cascade" }),
    formId: text("form_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    locale: text("locale"),
    isSelected: boolean("is_selected").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    assigneeIds: text("assignee_ids").array().notNull().default([]),
    assignmentStrategy: text("assignment_strategy").notNull().default("round_robin"),
    lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
    questions: jsonb("questions").$type<unknown[]>().notNull().default([]),
    fieldMapping: jsonb("field_mapping").$type<Record<string, string>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_forms_org_form_id_uidx").on(table.orgId, table.formId),
    index("facebook_forms_page_id_idx").on(table.pageId),
    index("facebook_forms_org_id_idx").on(table.orgId),
    check(
      "facebook_forms_assignment_strategy_check",
      sql`${table.assignmentStrategy} in ('round_robin', 'first')`,
    ),
  ],
);

export const facebookPixels = pgTable(
  "facebook_pixels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    businessId: uuid("business_id").references(() => facebookBusinesses.id, {
      onDelete: "set null",
    }),
    adAccountId: uuid("ad_account_id").references(() => facebookAccounts.id, {
      onDelete: "set null",
    }),
    pixelId: text("pixel_id").notNull(),
    name: text("name").notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    isSelected: boolean("is_selected").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_pixels_org_pixel_id_uidx").on(table.orgId, table.pixelId),
    index("facebook_pixels_org_id_idx").on(table.orgId),
  ],
);

export const facebookWebhooks = pgTable(
  "facebook_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    pageId: uuid("page_id").references(() => facebookPages.id, { onDelete: "set null" }),
    metaPageId: text("meta_page_id"),
    eventType: text("event_type").notNull().default("leadgen"),
    externalEventId: text("external_event_id"),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    signatureValid: boolean("signature_valid"),
    status: text("status").notNull().default("received"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "facebook_webhooks_status_check",
      sql`${table.status} in ('received', 'queued', 'processing', 'processed', 'failed', 'duplicate', 'skipped')`,
    ),
    uniqueIndex("facebook_webhooks_org_dedupe_uidx").on(table.orgId, table.dedupeKey),
    index("facebook_webhooks_status_idx").on(table.orgId, table.status),
    index("facebook_webhooks_created_at_idx").on(table.createdAt.desc()),
  ],
);

export const facebookCampaigns = pgTable(
  "facebook_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    adAccountId: uuid("ad_account_id").references(() => facebookAccounts.id, {
      onDelete: "cascade",
    }),
    campaignId: text("campaign_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    objective: text("objective"),
    dailyBudget: numeric("daily_budget", { precision: 14, scale: 2 }),
    lifetimeBudget: numeric("lifetime_budget", { precision: 14, scale: 2 }),
    startTime: timestamp("start_time", { withTimezone: true }),
    stopTime: timestamp("stop_time", { withTimezone: true }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    insights: jsonb("insights").$type<Record<string, unknown>>().notNull().default({}),
    insightsSyncedAt: timestamp("insights_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_campaigns_org_campaign_uidx").on(table.orgId, table.campaignId),
    index("facebook_campaigns_ad_account_idx").on(table.adAccountId),
  ],
);

export const facebookAdsets = pgTable(
  "facebook_adsets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id").references(() => facebookCampaigns.id, {
      onDelete: "cascade",
    }),
    adsetId: text("adset_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    dailyBudget: numeric("daily_budget", { precision: 14, scale: 2 }),
    insights: jsonb("insights").$type<Record<string, unknown>>().notNull().default({}),
    insightsSyncedAt: timestamp("insights_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_adsets_org_adset_uidx").on(table.orgId, table.adsetId),
    index("facebook_adsets_campaign_idx").on(table.campaignId),
  ],
);

export const facebookAds = pgTable(
  "facebook_ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    adsetId: uuid("adset_id").references(() => facebookAdsets.id, { onDelete: "cascade" }),
    adId: text("ad_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    creativeId: text("creative_id"),
    insights: jsonb("insights").$type<Record<string, unknown>>().notNull().default({}),
    insightsSyncedAt: timestamp("insights_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_ads_org_ad_uidx").on(table.orgId, table.adId),
    index("facebook_ads_adset_idx").on(table.adsetId),
  ],
);

/** Meta lead mirror; CRM ingest dedupe remains on `ad_leads`. */
export const facebookLeads = pgTable(
  "facebook_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    leadgenId: text("leadgen_id").notNull(),
    pageId: text("page_id"),
    formId: text("form_id"),
    campaignId: text("campaign_id"),
    adsetId: text("adset_id"),
    adId: text("ad_id"),
    campaignName: text("campaign_name"),
    adsetName: text("adset_name"),
    adName: text("ad_name"),
    formName: text("form_name"),
    pageName: text("page_name"),
    pixelId: text("pixel_id"),
    fullName: text("full_name"),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    zip: text("zip"),
    fbclid: text("fbclid"),
    fbc: text("fbc"),
    fbp: text("fbp"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    fieldData: jsonb("field_data").$type<Record<string, unknown>>().notNull().default({}),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdTime: timestamp("created_time", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_leads_org_leadgen_uidx").on(table.orgId, table.leadgenId),
    index("facebook_leads_lead_id_idx").on(table.leadId),
    index("facebook_leads_campaign_id_idx").on(table.orgId, table.campaignId),
    index("facebook_leads_created_time_idx").on(table.orgId, table.createdTime.desc()),
  ],
);

export const facebookEvents = pgTable(
  "facebook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    eventName: text("event_name").notNull(),
    source: text("source").notNull().default("webhook"),
    externalId: text("external_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("received"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("facebook_events_org_created_idx").on(table.orgId, table.createdAt.desc()),
    index("facebook_events_external_id_idx").on(table.orgId, table.externalId),
  ],
);

export const facebookLogs = pgTable(
  "facebook_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    level: text("level").notNull().default("info"),
    category: text("category").notNull(),
    message: text("message").notNull(),
    requestId: text("request_id"),
    latencyMs: integer("latency_ms"),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("facebook_logs_level_check", sql`${table.level} in ('debug', 'info', 'warn', 'error')`),
    index("facebook_logs_org_created_idx").on(table.orgId, table.createdAt.desc()),
    index("facebook_logs_category_idx").on(table.orgId, table.category),
  ],
);

export const facebookConversionEvents = pgTable(
  "facebook_conversion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    pixelId: text("pixel_id").notNull(),
    eventName: text("event_name").notNull(),
    eventId: text("event_id").notNull(),
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
    actionSource: text("action_source").notNull().default("system_generated"),
    eventSourceUrl: text("event_source_url"),
    userData: jsonb("user_data").$type<Record<string, unknown>>().notNull().default({}),
    customData: jsonb("custom_data").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"),
    httpStatus: integer("http_status"),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "facebook_conversion_events_status_check",
      sql`${table.status} in ('pending', 'sent', 'failed', 'skipped', 'deduped')`,
    ),
    uniqueIndex("facebook_conversion_events_event_id_uidx").on(table.orgId, table.eventId),
    index("facebook_conversion_events_status_idx").on(table.orgId, table.status),
    index("facebook_conversion_events_lead_idx").on(table.leadId),
  ],
);

export const facebookSyncHistory = pgTable(
  "facebook_sync_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    syncType: text("sync_type").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    recordsProcessed: integer("records_processed").notNull().default(0),
    recordsFailed: integer("records_failed").notNull().default(0),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    check(
      "facebook_sync_history_status_check",
      sql`${table.status} in ('running', 'success', 'partial', 'failed')`,
    ),
    index("facebook_sync_history_org_started_idx").on(table.orgId, table.startedAt.desc()),
  ],
);

export const facebookErrors = pgTable(
  "facebook_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    source: text("source").notNull(),
    errorCode: text("error_code"),
    errorSubcode: text("error_subcode"),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("facebook_errors_org_created_idx").on(table.orgId, table.createdAt.desc()),
    index("facebook_errors_unresolved_idx").on(table.orgId, table.resolved),
  ],
);

export const facebookRateLimits = pgTable(
  "facebook_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    endpoint: text("endpoint").notNull(),
    callCount: integer("call_count").notNull().default(0),
    estimatedTimeToRegainAccess: integer("estimated_time_to_regain_access"),
    appUsagePercent: numeric("app_usage_percent", { precision: 5, scale: 2 }),
    businessUsagePercent: numeric("business_usage_percent", { precision: 5, scale: 2 }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("facebook_rate_limits_org_endpoint_uidx").on(table.orgId, table.endpoint),
  ],
);

export const facebookTokensRelations = relations(facebookTokens, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facebookTokens.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [facebookTokens.userId],
    references: [users.id],
  }),
  businesses: many(facebookBusinesses),
}));

export const facebookBusinessesRelations = relations(facebookBusinesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facebookBusinesses.orgId],
    references: [organizations.id],
  }),
  token: one(facebookTokens, {
    fields: [facebookBusinesses.tokenId],
    references: [facebookTokens.id],
  }),
  accounts: many(facebookAccounts),
  pages: many(facebookPages),
  pixels: many(facebookPixels),
}));

export const facebookAccountsRelations = relations(facebookAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facebookAccounts.orgId],
    references: [organizations.id],
  }),
  business: one(facebookBusinesses, {
    fields: [facebookAccounts.businessId],
    references: [facebookBusinesses.id],
  }),
  campaigns: many(facebookCampaigns),
}));

export const facebookPagesRelations = relations(facebookPages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facebookPages.orgId],
    references: [organizations.id],
  }),
  business: one(facebookBusinesses, {
    fields: [facebookPages.businessId],
    references: [facebookBusinesses.id],
  }),
  forms: many(facebookForms),
  instagramAccounts: many(instagramAccounts),
}));

export const facebookFormsRelations = relations(facebookForms, ({ one }) => ({
  page: one(facebookPages, {
    fields: [facebookForms.pageId],
    references: [facebookPages.id],
  }),
}));

export const facebookLeadsRelations = relations(facebookLeads, ({ one }) => ({
  lead: one(leads, {
    fields: [facebookLeads.leadId],
    references: [leads.id],
  }),
}));

export const facebookConversionEventsRelations = relations(facebookConversionEvents, ({ one }) => ({
  lead: one(leads, {
    fields: [facebookConversionEvents.leadId],
    references: [leads.id],
  }),
}));
