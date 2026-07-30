/** Segment chips on the mobile Leads list (aligned with web stage filters). */
export type MobileLeadsStage = "overdue" | "pending" | "new" | "follow_up" | "hot";

export const MOBILE_LEAD_STAGES: { id: MobileLeadsStage; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "pending", label: "Pending" },
  { id: "new", label: "New" },
  { id: "follow_up", label: "Follow up" },
  { id: "hot", label: "Hot" },
];

export function defaultMobileLeadsStage(): MobileLeadsStage {
  return "new";
}

/** Map a segment chip to GET /api/leads query params. */
export function stageToLeadQuery(stage: MobileLeadsStage): Record<string, string> {
  const now = new Date().toISOString();

  switch (stage) {
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
      return { status: "new" };
  }
}
