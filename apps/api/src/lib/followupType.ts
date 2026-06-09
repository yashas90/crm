export type FollowupReminderType = "callback" | "meeting" | "site_visit";

export function inferFollowupType(input: {
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
}): FollowupReminderType {
  const custom = input.customFields ?? {};
  const explicit = custom.followup_type ?? custom.followupType ?? custom.reminder_type;

  if (explicit === "meeting" || explicit === "site_visit" || explicit === "callback") {
    return explicit;
  }

  const tags = (input.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("site") || tag === "site_visit")) {
    return "site_visit";
  }
  if (tags.some((tag) => tag.includes("meeting"))) {
    return "meeting";
  }

  return "callback";
}
