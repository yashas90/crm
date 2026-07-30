import type { LeadRow } from "@/hooks/use-leads";
import { inferFollowupType } from "@/lib/followup-type";

export type LeadStatusDisplay = {
  primary: string;
  primaryClass: string;
  /** @deprecated Prefer a single primary chip — kept for callers that still read it. */
  secondary?: string;
  secondaryClass: string;
};

const STYLES = {
  new: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  callback: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  overdue: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  qualified: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  muted: "bg-muted text-muted-foreground",
} as const;

const NEW_LEAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function tagIncludes(tags: string[], needle: string) {
  return tags.some((tag) => tag.includes(needle));
}

function display(primary: string, primaryClass: string): LeadStatusDisplay {
  return { primary, primaryClass, secondaryClass: STYLES.callback };
}

/**
 * Single status chip for the leads table:
 * - New → stays New until Call Back / Site Visit (or other status change)
 * - After 24h without a status update → Pending
 * - Call Back / Site Visit / Meeting when a follow-up is scheduled
 * - Overdue only after an agent-scheduled follow-up time has passed
 *
 * Untouched `new` leads ignore nextFollowupAt (Meta auto-tasks must not force Overdue).
 */
export function getLeadStatusDisplay(
  lead: Pick<LeadRow, "leadStatus" | "tags" | "customFields" | "nextFollowupAt" | "createdAt">,
  now: Date = new Date(),
): LeadStatusDisplay {
  const tags = (lead.tags ?? []).map((tag) => tag.toLowerCase());

  if (tagIncludes(tags, "not_interested")) {
    return display("Not Interested", STYLES.lost);
  }

  if (tagIncludes(tags, "no_answer") || tagIncludes(tags, "not_answered")) {
    return display("Not Answered", STYLES.lost);
  }

  if (lead.leadStatus === "new") {
    const createdAtMs = lead.createdAt ? new Date(lead.createdAt).getTime() : Number.NaN;
    const isStale =
      Number.isFinite(createdAtMs) && now.getTime() - createdAtMs > NEW_LEAD_MAX_AGE_MS;
    return isStale ? display("Pending", STYLES.pending) : display("New", STYLES.new);
  }

  if (lead.nextFollowupAt) {
    const due = new Date(lead.nextFollowupAt).getTime();
    if (Number.isFinite(due) && due <= now.getTime()) {
      return display("Overdue", STYLES.overdue);
    }

    const type = inferFollowupType(lead);
    if (type === "meeting") return display("Meeting", STYLES.callback);
    if (type === "site_visit") return display("Site Visit", STYLES.callback);
    return display("Callback", STYLES.callback);
  }

  if (lead.leadStatus === "contacted") {
    return display("Pending", STYLES.pending);
  }

  if (lead.leadStatus === "qualified") return display("Qualified", STYLES.qualified);
  if (lead.leadStatus === "negotiation") return display("Negotiation", STYLES.negotiation);
  if (lead.leadStatus === "won") return display("Won", STYLES.won);
  if (lead.leadStatus === "lost") return display("Lost", STYLES.lost);
  if (lead.leadStatus === "not_interested") return display("Not Interested", STYLES.lost);
  if (lead.leadStatus === "dropped") return display("Dropped", STYLES.muted);

  return display(lead.leadStatus, STYLES.muted);
}
