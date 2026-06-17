import type { callRecords, leads, users } from "@propninja/db";

type CallRow = typeof callRecords.$inferSelect;
type LeadRow = typeof leads.$inferSelect | null;
type UserRow = typeof users.$inferSelect | null;

export type CallListItem = {
  id: string;
  leadId: string | null;
  leadName: string | null;
  phone: string;
  outcome: string | null;
  duration: number;
  notes: string | null;
  calledAt: string;
  agentName: string | null;
};

function leadDisplayName(lead: { firstName: string | null; lastName: string | null } | null) {
  if (!lead) return null;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

export function mapCallListItem(row: {
  call: CallRow;
  lead: LeadRow;
  user: UserRow;
}): CallListItem {
  return {
    id: row.call.id,
    leadId: row.call.leadId,
    leadName: leadDisplayName(row.lead),
    phone: row.call.phoneNumber,
    outcome: row.call.outcome,
    duration: Math.max(0, Math.round(row.call.durationSeconds / 60)),
    notes: row.call.notes,
    calledAt: row.call.startedAt.toISOString(),
    agentName: row.user?.name ?? null,
  };
}

/** Map a flattened listCalls item (spread call + nested lead). */
export function mapCallListItemFromListRow(record: {
  id: string;
  leadId: string | null;
  phoneNumber: string;
  outcome: string | null;
  durationSeconds: number;
  notes: string | null;
  startedAt: Date | string;
  lead?: { firstName: string | null; lastName: string | null } | null;
  userName?: string | null;
  user?: { firstName: string | null; lastName: string | null; name?: string } | null;
}): CallListItem {
  const startedAt =
    record.startedAt instanceof Date ? record.startedAt : new Date(record.startedAt);

  return {
    id: record.id,
    leadId: record.leadId,
    leadName: leadDisplayName(record.lead ?? null),
    phone: record.phoneNumber,
    outcome: record.outcome,
    duration: Math.max(0, Math.round(record.durationSeconds / 60)),
    notes: record.notes,
    calledAt: startedAt.toISOString(),
    agentName: record.userName ?? record.user?.name ?? null,
  };
}
