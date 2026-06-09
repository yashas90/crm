import type { LeadRow } from "@/hooks/use-leads";
import { inferFollowupType } from "@/lib/followup-type";

export type LeadStatusDisplay = {
  primary: string;
  primaryClass: string;
  secondary?: string;
  secondaryClass: string;
};

const PRIMARY_STYLES: Record<string, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  },
  contacted: {
    label: "Pending",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  },
  qualified: {
    label: "Qualified",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  won: {
    label: "Won",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  lost: {
    label: "Lost",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

const SECONDARY_CLASS = "text-teal-700 dark:text-teal-300";
const NEGATIVE_CLASS = "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";

function tagIncludes(tags: string[], needle: string) {
  return tags.some((tag) => tag.includes(needle));
}

function followupSecondaryLabel(
  lead: Pick<LeadRow, "tags" | "customFields" | "nextFollowupAt">,
): string | undefined {
  const tags = (lead.tags ?? []).map((tag) => tag.toLowerCase());

  if (tagIncludes(tags, "follow_up") || tagIncludes(tags, "follow-up")) {
    return "Follow Up";
  }
  if (tagIncludes(tags, "callback")) {
    return "Callback";
  }

  if (!lead.nextFollowupAt) {
    return undefined;
  }

  const type = inferFollowupType(lead);
  if (type === "meeting") return "Meeting";
  if (type === "site_visit") return "Site Visit";
  return "Callback";
}

/** Maps lead_status + tags/follow-up hints to screenshot-style status chips. */
export function getLeadStatusDisplay(
  lead: Pick<LeadRow, "leadStatus" | "tags" | "customFields" | "nextFollowupAt">,
): LeadStatusDisplay {
  const tags = (lead.tags ?? []).map((tag) => tag.toLowerCase());

  if (tagIncludes(tags, "not_interested")) {
    return {
      primary: "Not Interested",
      primaryClass: NEGATIVE_CLASS,
      secondaryClass: SECONDARY_CLASS,
    };
  }

  if (tagIncludes(tags, "no_answer") || tagIncludes(tags, "not_answered")) {
    return {
      primary: "Not Answered",
      primaryClass: NEGATIVE_CLASS,
      secondaryClass: SECONDARY_CLASS,
    };
  }

  const mapped = PRIMARY_STYLES[lead.leadStatus] ?? {
    label: lead.leadStatus,
    className: "bg-muted text-muted-foreground",
  };

  const secondary = followupSecondaryLabel(lead);

  return {
    primary: mapped.label,
    primaryClass: mapped.className,
    secondary,
    secondaryClass: SECONDARY_CLASS,
  };
}
