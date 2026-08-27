export type CallLogItem = {
  id: string;
  leadId: string | null;
  leadName: string | null;
  phone: string;
  outcome: string | null;
  duration: number;
  durationSeconds: number;
  notes: string | null;
  calledAt: string;
  agentName?: string | null;
};

export type ApiCallRecord = {
  id: string;
  leadId: string | null;
  phoneNumber: string;
  outcome: string | null;
  durationSeconds: number;
  notes: string | null;
  startedAt: string;
  userName?: string | null;
  lead?: { firstName: string; lastName: string } | null;
};

export type ApiCallsListResponse = {
  items: ApiCallRecord[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiCallsSummary = {
  total_calls: number;
  completed_calls: number;
  answered_calls?: number;
  missed_calls: number;
  average_duration: number;
};

export function mapCallRecordToLogItem(record: ApiCallRecord): CallLogItem {
  const leadName = record.lead ? `${record.lead.firstName} ${record.lead.lastName}`.trim() : null;

  return {
    id: record.id,
    leadId: record.leadId,
    leadName: leadName || null,
    phone: record.phoneNumber,
    outcome: record.outcome,
    durationSeconds: Math.max(0, record.durationSeconds ?? 0),
    duration: Math.max(0, Math.round((record.durationSeconds ?? 0) / 60)),
    notes: record.notes,
    calledAt: record.startedAt,
    agentName: record.userName ?? null,
  };
}

export function callsListQuery(params: {
  page: number;
  pageSize: number;
  dateFrom: string;
  dateTo: string;
  userId?: string;
  outcome?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    date_from: params.dateFrom,
    date_to: params.dateTo,
  });
  if (params.userId) search.set("user_id", params.userId);
  if (params.outcome) search.set("outcome", params.outcome);
  return search.toString();
}

export function callsSummaryQuery(dateFrom: string, dateTo: string, userId?: string) {
  const search = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  if (userId) search.set("user_id", userId);
  return search.toString();
}
