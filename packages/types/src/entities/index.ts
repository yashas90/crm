import type {
  CallRecord as DbCallRecord,
  Lead as DbLead,
  LeadActivity as DbLeadActivity,
  Organization as DbOrganization,
  TcfConsent as DbTcfConsent,
  User as DbUser,
} from "@propninja/db";
import type {
  CallRecordId,
  LeadActivityId,
  LeadId,
  OrgId,
  TcfConsentId,
  UserId,
} from "../brands.js";
import type {
  ActivityType,
  CallDirection,
  CallSource,
  CallStatus,
  ConsentType,
  LeadStatus,
  LeadTemperature,
  UserRole,
} from "../enums/index.js";

type ReplaceIds<T, M extends Record<string, unknown>> = Omit<T, keyof M> & M;

export type Organization = ReplaceIds<DbOrganization, { id: OrgId }>;

export type User = ReplaceIds<DbUser, { id: UserId; orgId: OrgId }> & {
  role: UserRole;
};

export type Lead = ReplaceIds<DbLead, { id: LeadId; orgId: OrgId; assignedTo: UserId | null }> & {
  leadStatus: LeadStatus;
  temperature: LeadTemperature | null;
};

export type CallRecord = ReplaceIds<
  DbCallRecord,
  { id: CallRecordId; orgId: OrgId; userId: UserId; leadId: LeadId | null }
> & {
  direction: CallDirection;
  status: CallStatus;
  source: CallSource;
};

export type LeadActivity = ReplaceIds<
  DbLeadActivity,
  { id: LeadActivityId; leadId: LeadId; orgId: OrgId; userId: UserId | null }
> & {
  type: ActivityType;
};

export type TcfConsent = ReplaceIds<DbTcfConsent, { id: TcfConsentId; leadId: LeadId }> & {
  consentType: ConsentType;
};
