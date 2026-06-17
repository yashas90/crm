import { leads, tasks } from "@propninja/db";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "@propninja/types/enums";
import { and, eq, isNull } from "drizzle-orm";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";

const FOLLOW_UP_OUTCOMES = ["no_answer", "busy", "left_voicemail"] as const;
type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number];

function isFollowUpOutcome(outcome: string): outcome is FollowUpOutcome {
  return (FOLLOW_UP_OUTCOMES as readonly string[]).includes(outcome);
}

function formatAttemptTime(date: Date): string {
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function leadDisplayName(firstName: string, lastName: string | null): string {
  return `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();
}

export function getCallFollowUpConfig(outcome: CallOutcome, leadName: string, attemptedAt: Date) {
  const timeLabel = formatAttemptTime(attemptedAt);
  const outcomeLabel = CALL_OUTCOME_LABELS[outcome];

  if (outcome === "no_answer" || outcome === "busy") {
    const dueAt = new Date(attemptedAt.getTime() + 2 * 60 * 60 * 1000);
    return {
      title: `Call back ${leadName}`,
      priority: "high" as const,
      dueAt,
      description: `Auto-created: call attempt at ${timeLabel} was ${outcomeLabel}`,
      notificationMessage: `Reminder set: Call back ${leadName} in 2 hours`,
      followUpHours: 2,
    };
  }

  if (outcome === "left_voicemail") {
    const dueAt = new Date(attemptedAt.getTime() + 24 * 60 * 60 * 1000);
    return {
      title: `Follow up with ${leadName} (voicemail left)`,
      priority: "medium" as const,
      dueAt,
      description: `Auto-created: call attempt at ${timeLabel} was ${outcomeLabel}`,
      notificationMessage: `Reminder set: Follow up with ${leadName} in 24 hours`,
      followUpHours: 24,
    };
  }

  return null;
}

export type CallFollowUpTaskResult = {
  id: string;
  title: string;
  dueAt: Date;
  priority: string;
  assignedTo: string | null;
  leadId: string | null;
  followUpHours: number;
};

export async function createCallFollowUpTask(params: {
  userId: string;
  leadId: string;
  outcome: string;
  attemptedAt: Date;
}): Promise<CallFollowUpTaskResult | null> {
  if (!isFollowUpOutcome(params.outcome)) {
    return null;
  }

  const [lead] = await db
    .select({ firstName: leads.firstName, lastName: leads.lastName })
    .from(leads)
    .where(
      and(
        eq(leads.id, params.leadId),
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
      ),
    )
    .limit(1);

  if (!lead) {
    return null;
  }

  const leadName = leadDisplayName(lead.firstName, lead.lastName);
  const config = getCallFollowUpConfig(params.outcome, leadName, params.attemptedAt);
  if (!config) {
    return null;
  }

  const [task] = await db
    .insert(tasks)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      title: config.title,
      description: config.description,
      dueAt: config.dueAt,
      priority: config.priority,
      taskType: "call",
      status: "pending",
      leadId: params.leadId,
      assignedTo: params.userId,
      createdBy: params.userId,
    })
    .returning();

  if (!task) {
    return null;
  }

  const notifications = createNotificationService(db);
  await notifications.createNotification(params.userId, NOTIFICATION_TYPES.CALL_FOLLOWUP_SET, {
    taskId: task.id,
    leadId: params.leadId,
    leadName,
    message: config.notificationMessage,
  });

  return {
    id: task.id,
    title: task.title,
    dueAt: task.dueAt!,
    priority: task.priority,
    assignedTo: task.assignedTo,
    leadId: task.leadId,
    followUpHours: config.followUpHours,
  };
}
