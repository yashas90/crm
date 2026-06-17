import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCallFollowUpConfig } from "./callFollowUpTask.js";

describe("getCallFollowUpConfig", () => {
  const attemptedAt = new Date("2026-06-16T10:00:00.000Z");
  const leadName = "Jane Doe";

  it("returns 2-hour follow-up for no_answer", () => {
    const config = getCallFollowUpConfig("no_answer", leadName, attemptedAt);
    expect(config).not.toBeNull();
    expect(config!.title).toBe("Call back Jane Doe");
    expect(config!.priority).toBe("high");
    expect(config!.followUpHours).toBe(2);
    expect(config!.dueAt.getTime()).toBe(attemptedAt.getTime() + 2 * 60 * 60 * 1000);
    expect(config!.description).toContain("No Answer");
    expect(config!.notificationMessage).toBe("Reminder set: Call back Jane Doe in 2 hours");
  });

  it("returns 2-hour follow-up for busy", () => {
    const config = getCallFollowUpConfig("busy", leadName, attemptedAt);
    expect(config).not.toBeNull();
    expect(config!.title).toBe("Call back Jane Doe");
    expect(config!.priority).toBe("high");
    expect(config!.followUpHours).toBe(2);
    expect(config!.dueAt.getTime()).toBe(attemptedAt.getTime() + 2 * 60 * 60 * 1000);
  });

  it("returns 24-hour follow-up for left_voicemail", () => {
    const config = getCallFollowUpConfig("left_voicemail", leadName, attemptedAt);
    expect(config).not.toBeNull();
    expect(config!.title).toBe("Follow up with Jane Doe (voicemail left)");
    expect(config!.priority).toBe("medium");
    expect(config!.followUpHours).toBe(24);
    expect(config!.dueAt.getTime()).toBe(attemptedAt.getTime() + 24 * 60 * 60 * 1000);
    expect(config!.description).toContain("Left Voicemail");
    expect(config!.notificationMessage).toBe("Reminder set: Follow up with Jane Doe in 24 hours");
  });

  it("returns null for answered", () => {
    expect(getCallFollowUpConfig("answered", leadName, attemptedAt)).toBeNull();
  });
});

const mockInsertReturning = vi.fn();
const mockSelectLimit = vi.fn();
const mockCreateNotification = vi.fn();

vi.mock("./db.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelectLimit,
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: mockInsertReturning,
      }),
    }),
  },
}));

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { CALL_FOLLOWUP_SET: "call_followup_set" },
  createNotificationService: () => ({
    createNotification: mockCreateNotification,
  }),
}));

describe("createCallFollowUpTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: "notif-1" });
  });

  it("creates task with correct assigneeId, leadId, and priority for no_answer", async () => {
    mockSelectLimit.mockResolvedValue([{ firstName: "Jane", lastName: "Doe" }]);
    const dueAt = new Date("2026-06-16T12:00:00.000Z");
    mockInsertReturning.mockResolvedValue([
      {
        id: "task-1",
        title: "Call back Jane Doe",
        dueAt,
        priority: "high",
        assignedTo: "agent-1",
        leadId: "lead-1",
        taskType: "call",
        status: "pending",
      },
    ]);

    const { createCallFollowUpTask } = await import("./callFollowUpTask.js");
    const result = await createCallFollowUpTask({
      userId: "agent-1",
      leadId: "lead-1",
      outcome: "no_answer",
      attemptedAt: new Date("2026-06-16T10:00:00.000Z"),
    });

    expect(result).toMatchObject({
      id: "task-1",
      assignedTo: "agent-1",
      leadId: "lead-1",
      priority: "high",
      followUpHours: 2,
    });
    expect(result!.dueAt.getTime()).toBe(new Date("2026-06-16T12:00:00.000Z").getTime());
    expect(mockCreateNotification).toHaveBeenCalledWith(
      "agent-1",
      "call_followup_set",
      expect.objectContaining({
        taskId: "task-1",
        leadId: "lead-1",
        message: "Reminder set: Call back Jane Doe in 2 hours",
      }),
    );
  });

  it("creates task for busy outcome", async () => {
    mockSelectLimit.mockResolvedValue([{ firstName: "Jane", lastName: "Doe" }]);
    mockInsertReturning.mockResolvedValue([
      {
        id: "task-2",
        title: "Call back Jane Doe",
        dueAt: new Date("2026-06-16T12:00:00.000Z"),
        priority: "high",
        assignedTo: "agent-1",
        leadId: "lead-1",
      },
    ]);

    const { createCallFollowUpTask } = await import("./callFollowUpTask.js");
    const result = await createCallFollowUpTask({
      userId: "agent-1",
      leadId: "lead-1",
      outcome: "busy",
      attemptedAt: new Date("2026-06-16T10:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result!.followUpHours).toBe(2);
  });

  it("creates task with 24h due for voicemail", async () => {
    mockSelectLimit.mockResolvedValue([{ firstName: "Jane", lastName: "Doe" }]);
    const dueAt = new Date("2026-06-17T10:00:00.000Z");
    mockInsertReturning.mockResolvedValue([
      {
        id: "task-3",
        title: "Follow up with Jane Doe (voicemail left)",
        dueAt,
        priority: "medium",
        assignedTo: "agent-1",
        leadId: "lead-1",
      },
    ]);

    const { createCallFollowUpTask } = await import("./callFollowUpTask.js");
    const result = await createCallFollowUpTask({
      userId: "agent-1",
      leadId: "lead-1",
      outcome: "left_voicemail",
      attemptedAt: new Date("2026-06-16T10:00:00.000Z"),
    });

    expect(result).toMatchObject({
      priority: "medium",
      followUpHours: 24,
    });
    expect(result!.dueAt.getTime()).toBe(dueAt.getTime());
  });

  it("does not create task for answered", async () => {
    const { createCallFollowUpTask } = await import("./callFollowUpTask.js");
    const result = await createCallFollowUpTask({
      userId: "agent-1",
      leadId: "lead-1",
      outcome: "answered",
      attemptedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockInsertReturning).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
