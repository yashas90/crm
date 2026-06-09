import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  callRecords,
  leadActivities,
  leads,
  organizations,
  projects,
  tcfConsents,
  userRoles,
  users,
} from "./index.js";

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type UserRoleRecord = InferSelectModel<typeof userRoles>;
export type NewUserRoleRecord = InferInsertModel<typeof userRoles>;

export type Lead = InferSelectModel<typeof leads>;
export type NewLead = InferInsertModel<typeof leads>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type CallRecord = InferSelectModel<typeof callRecords>;
export type NewCallRecord = InferInsertModel<typeof callRecords>;

export type LeadActivity = InferSelectModel<typeof leadActivities>;
export type NewLeadActivity = InferInsertModel<typeof leadActivities>;

export type TcfConsent = InferSelectModel<typeof tcfConsents>;
export type NewTcfConsent = InferInsertModel<typeof tcfConsents>;

export type UserRole = "admin" | "manager" | "agent";
export type LeadStatus = "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
export type LeadTemperature = "cold" | "warm" | "hot";
export type CallDirection = "incoming" | "outgoing";
export type CallRecordStatus = "completed" | "missed" | "rejected" | "failed";
export type CallRecordSource = "mobile-manual" | "mobile-auto";
export type LeadActivityType = "call" | "note" | "status_change" | "meeting" | "task";
export type ConsentType = "call" | "sms" | "email";
export type ProjectStatus = "new" | "pre_launch" | "launch" | "ongoing" | "completed";
export type ProjectType = "residential" | "commercial" | "agricultural" | "plot" | "mixed";
export type ProjectCategory = "residential" | "commercial" | "agricultural";
