/** Segment chips on the mobile Leads list (aligned with web stage filters). */
export type MobileLeadsStage = "active" | "overdue" | "pending" | "new" | "follow_up" | "hot";

export const MOBILE_LEAD_STAGES: { id: MobileLeadsStage; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "new", label: "New" },
  { id: "overdue", label: "Overdue" },
  { id: "follow_up", label: "Follow up" },
  { id: "hot", label: "Hot" },
];

/**
 * Default to Active — same as web. Pending only has contacted/stale-new with no
 * follow-up; New is ≤24h only. Active shows the open assigned book.
 */
export function defaultMobileLeadsStage(): MobileLeadsStage {
  return "active";
}

/** Map a segment chip to GET /api/leads query params. */
export function stageToLeadQuery(stage: MobileLeadsStage): Record<string, string> {
  const now = new Date().toISOString();

  switch (stage) {
    case "active":
      return { activeOnly: "true", excludeNew: "true" };
    case "overdue":
      return {
        followUpDueBefore: now,
        activeOnly: "true",
        orderByFollowUp: "true",
      };
    case "pending":
      return { status: "contacted" };
    case "new":
      return { status: "new" };
    case "follow_up":
      return {
        followUpDueAfter: now,
        activeOnly: "true",
        orderByFollowUp: "true",
      };
    case "hot":
      return { temperature: "hot" };
    default:
      return { activeOnly: "true", excludeNew: "true" };
  }
}
