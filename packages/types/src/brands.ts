export type OrgId = string & { __brand: "OrgId" };
export type UserId = string & { __brand: "UserId" };
export type LeadId = string & { __brand: "LeadId" };
export type CallRecordId = string & { __brand: "CallRecordId" };
export type LeadActivityId = string & { __brand: "LeadActivityId" };
export type TcfConsentId = string & { __brand: "TcfConsentId" };

export function asOrgId(id: string): OrgId {
  return id as OrgId;
}

export function asUserId(id: string): UserId {
  return id as UserId;
}

export function asLeadId(id: string): LeadId {
  return id as LeadId;
}

export function asCallRecordId(id: string): CallRecordId {
  return id as CallRecordId;
}

export function asLeadActivityId(id: string): LeadActivityId {
  return id as LeadActivityId;
}

export function asTcfConsentId(id: string): TcfConsentId {
  return id as TcfConsentId;
}
