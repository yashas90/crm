import type { CallRecordId, LeadId, UserId } from "../brands.js";
import type { CallRecord } from "../entities/index.js";
import type { CallDirection, CallSource, CallStatus } from "../enums/index.js";
import type { CallListFilter } from "../filters/index.js";
import type { ApiResponse } from "./common.js";

export type ListCallLogsRequest = CallListFilter;

export type CreateCallLogRequest = {
  leadId?: LeadId | null;
  phoneNumber: string;
  direction: CallDirection;
  status: CallStatus;
  source: CallSource;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  disposition?: string | null;
  notes?: string | null;
};

export type CallLogSummary = {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  rejectedCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  incomingCalls: number;
  outgoingCalls: number;
  byUser: Array<{
    userId: UserId;
    callCount: number;
    totalDurationSeconds: number;
  }>;
  byStatus: Record<CallStatus, number>;
};

export type ListCallLogsResponse = ApiResponse<CallRecord[]>;
export type CreateCallLogResponse = ApiResponse<CallRecord>;
export type GetCallLogResponse = ApiResponse<CallRecord>;
export type CallLogSummaryResponse = ApiResponse<CallLogSummary>;
export type DeleteCallLogResponse = ApiResponse<{ id: CallRecordId }>;
