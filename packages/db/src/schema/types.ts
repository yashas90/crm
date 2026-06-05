import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  callRecords,
  leadActivities,
  leads,
  organizations,
  tcfConsents,
  users,
} from "./index.js";

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Lead = InferSelectModel<typeof leads>;
export type NewLead = InferInsertModel<typeof leads>;

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
