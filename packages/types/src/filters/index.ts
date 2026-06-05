import type { LeadId, UserId } from "../brands.js";
import type {
  CallDirection,
  CallSource,
  CallStatus,
  LeadStatus,
  LeadTemperature,
} from "../enums/index.js";

export type SortOrder = "asc" | "desc";

export type LeadListFilter = {
  search?: string;
  leadStatus?: LeadStatus[];
  temperature?: LeadTemperature[];
  assignedTo?: UserId[];
  leadSource?: string[];
  tags?: string[];
  city?: string;
  state?: string;
  hasFollowupDue?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "lastContactedAt" | "nextFollowupAt";
  sortOrder?: SortOrder;
};

export type CallListFilter = {
  userIds?: UserId[];
  leadId?: LeadId;
  phoneNumber?: string;
  direction?: CallDirection[];
  status?: CallStatus[];
  source?: CallSource[];
  startedAfter?: string;
  startedBefore?: string;
  page?: number;
  pageSize?: number;
  sortOrder?: SortOrder;
};

export type ReportFilter = {
  dateFrom: string;
  dateTo: string;
  userIds?: UserId[];
  leadStatus?: LeadStatus[];
  groupBy?: "day" | "week" | "month";
};
