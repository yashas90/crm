import { inferFollowupType } from "@/lib/followup-type";

export type LeadStatusDisplayInput = {
  leadStatus?: string | null;
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
  nextFollowupAt?: string | null;
  createdAt?: string | null;
};

export type LeadStatusDisplay = {
  primary: string;
  tone: "new" | "pending" | "callback" | "overdue" | "qualified" | "negotiation" | "won" | "lost" | "muted";
};

const NEW_LEAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function tagIncludes(tags: string[], needle: string) {
  return tags.some((tag) => tag.includes(needle));
}

/**
 * Single status label for list/detail:
 * - New → stays New for ≤24h until agent changes status or schedules follow-up
 * - After 24h without a status update → Pending
 * - Call Back / Site Visit / Meeting when a follow-up is scheduled
 * - Overdue only after an agent-scheduled follow-up time has passed
 * - Otherwise the agent's chosen CRM status
 */
export function getLeadStatusDisplay(
  lead: LeadStatusDisplayInput,
  now: Date = new Date(),
): LeadStatusDisplay {
  const tags = (lead.tags ?? []).map((tag) => tag.toLowerCase());
  const status = lead.leadStatus ?? "new";

  if (tagIncludes(tags, "not_interested") || status === "not_interested") {
    return { primary: "Not Interested", tone: "lost" };
  }

  if (tagIncludes(tags, "no_answer") || tagIncludes(tags, "not_answered")) {
    return { primary: "Not Answered", tone: "lost" };
  }

  if (status === "new") {
    const createdAtMs = lead.createdAt ? new Date(lead.createdAt).getTime() : Number.NaN;
    const isStale =
      Number.isFinite(createdAtMs) && now.getTime() - createdAtMs > NEW_LEAD_MAX_AGE_MS;
    return isStale
      ? { primary: "Pending", tone: "pending" }
      : { primary: "New", tone: "new" };
  }

  if (lead.nextFollowupAt) {
    const due = new Date(lead.nextFollowupAt).getTime();
    if (Number.isFinite(due) && due <= now.getTime()) {
      return { primary: "Overdue", tone: "overdue" };
    }

    const type = inferFollowupType(lead);
    if (type === "meeting") return { primary: "Meeting", tone: "callback" };
    if (type === "site_visit") return { primary: "Site Visit", tone: "callback" };
    return { primary: "Callback", tone: "callback" };
  }

  if (status === "contacted") {
    return { primary: "Pending", tone: "pending" };
  }

  if (status === "qualified") return { primary: "Qualified", tone: "qualified" };
  if (status === "negotiation") return { primary: "Negotiation", tone: "negotiation" };
  if (status === "won") return { primary: "Won", tone: "won" };
  if (status === "lost") return { primary: "Lost", tone: "lost" };
  if (status === "dropped") return { primary: "Dropped", tone: "muted" };

  return {
    primary: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "muted",
  };
}
