import type { UserId } from "../brands.js";
import type { LeadStatus } from "../enums/index.js";
import type { ReportFilter } from "../filters/index.js";
import type { ApiResponse } from "./common.js";

export type DashboardReportRequest = Pick<ReportFilter, "dateFrom" | "dateTo" | "userIds">;

export type DashboardReport = {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  averageCallDurationSeconds: number;
  leadsByStatus: Record<LeadStatus, number>;
  callsByDay: Array<{
    date: string;
    callCount: number;
    completedCount: number;
  }>;
  topAgents: Array<{
    userId: UserId;
    name: string;
    leadsAssigned: number;
    callsMade: number;
    wonLeads: number;
  }>;
};

export type LeadsReportRequest = ReportFilter;

export type LeadsReport = {
  totalLeads: number;
  conversionRate: number;
  averageTimeToContactHours: number;
  byStatus: Record<LeadStatus, number>;
  bySource: Array<{
    source: string;
    count: number;
    wonCount: number;
  }>;
  byTemperature: Array<{
    temperature: string;
    count: number;
  }>;
  trend: Array<{
    period: string;
    created: number;
    won: number;
    lost: number;
  }>;
};

export type CallsReportRequest = ReportFilter;

export type CallsReport = {
  totalCalls: number;
  completedRate: number;
  missedRate: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  byDirection: {
    incoming: number;
    outgoing: number;
  };
  bySource: Array<{
    source: string;
    count: number;
  }>;
  byAgent: Array<{
    userId: UserId;
    name: string;
    callCount: number;
    completedCount: number;
    totalDurationSeconds: number;
  }>;
  trend: Array<{
    period: string;
    total: number;
    completed: number;
    missed: number;
  }>;
};

export type DashboardReportResponse = ApiResponse<DashboardReport>;
export type LeadsReportResponse = ApiResponse<LeadsReport>;
export type CallsReportResponse = ApiResponse<CallsReport>;
