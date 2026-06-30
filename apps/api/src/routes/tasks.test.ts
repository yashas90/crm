import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AGENT_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  role: "agent" as const,
  email: "agent@test.com",
  name: "Agent",
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const MANAGER_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  role: "manager" as const,
  email: "manager@test.com",
  name: "Manager",
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const OTHER_USER_ID = "00000000-0000-0000-0000-000000000099";
const TASK_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TASK_ID_2 = "aaaaaaaa-0000-0000-0000-000000000002";

const SAMPLE_TASK = {
  id: TASK_ID,
  title: "Call lead",
  description: null,
  status: "pending",
  priority: "medium",
  taskType: "call",
  dueAt: null,
  leadId: null,
  assignedTo: AGENT_USER.id,
  createdBy: AGENT_USER.id,
  notes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  getByIds: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  complete: vi.fn(),
  addNote: vi.fn(),
  bulkComplete: vi.fn(),
  bulkReassign: vi.fn(),
  bulkDelete: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../services/taskService.js", () => ({
  taskService: {
    list: mocks.list,
    getById: mocks.getById,
    getByIds: mocks.getByIds,
    create: mocks.create,
    update: mocks.update,
    delete: mocks.delete,
    complete: mocks.complete,
    addNote: mocks.addNote,
    bulkComplete: mocks.bulkComplete,
    bulkReassign: mocks.bulkReassign,
    bulkDelete: mocks.bulkDelete,
  },
}));

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { TASK_ASSIGNED: "task_assigned" },
  createNotificationService: () => ({
    createNotification: mocks.createNotification,
  }),
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

async function makeApp(user: typeof AGENT_USER | typeof MANAGER_USER) {
  const { tasksRoutes } = await import("../routes/tasks.js");
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("db", {});
    c.set("authUser", user);
    await next();
  });
  app.route("/api/tasks", tasksRoutes);
  return app;
}

// Build apps once — mocks are already registered at module level
let agentApp: Hono;
let managerApp: Hono;

beforeEach(async () => {
  vi.clearAllMocks();
  if (!agentApp) agentApp = await makeApp(AGENT_USER);
  if (!managerApp) managerApp = await makeApp(MANAGER_USER);
});

describe("GET /api/tasks", () => {
  beforeEach(() => {
    mocks.list.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 });
  });

  it("returns task list for manager", async () => {
    const res = await managerApp.request("/api/tasks");
    expect(res.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("agent list is scoped to themselves", async () => {
    await agentApp.request("/api/tasks");
    const callArg = mocks.list.mock.calls[0][0];
    expect(callArg.assignedTo).toBe(AGENT_USER.id);
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    mocks.create.mockResolvedValue(SAMPLE_TASK);
    mocks.createNotification.mockResolvedValue(undefined);
  });

  it("manager can create and assign task to another user", async () => {
    const res = await managerApp.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Call lead", assignedTo: OTHER_USER_ID }),
    });
    expect(res.status).toBe(201);
  });

  it("agent cannot assign task to another user", async () => {
    const res = await agentApp.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Call lead", assignedTo: OTHER_USER_ID }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("agent can create task assigned to themselves", async () => {
    const res = await agentApp.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Call lead", assignedTo: AGENT_USER.id }),
    });
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing title", async () => {
    const res = await managerApp.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo: OTHER_USER_ID }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns task for manager regardless of assignee", async () => {
    mocks.getById.mockResolvedValue({ ...SAMPLE_TASK, assignedTo: OTHER_USER_ID });
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`);
    expect(res.status).toBe(200);
  });

  it("agent can access own task", async () => {
    mocks.getById.mockResolvedValue({ ...SAMPLE_TASK, assignedTo: AGENT_USER.id });
    const res = await agentApp.request(`/api/tasks/${TASK_ID}`);
    expect(res.status).toBe(200);
  });

  it("agent cannot access task assigned to another", async () => {
    mocks.getById.mockResolvedValue({ ...SAMPLE_TASK, assignedTo: OTHER_USER_ID });
    const res = await agentApp.request(`/api/tasks/${TASK_ID}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for missing task", async () => {
    mocks.getById.mockResolvedValue(null);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/tasks/:id", () => {
  beforeEach(() => {
    mocks.update.mockResolvedValue(SAMPLE_TASK);
    mocks.createNotification.mockResolvedValue(undefined);
  });

  it("manager can update any task", async () => {
    mocks.getById.mockResolvedValue(SAMPLE_TASK);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });
    expect(res.status).toBe(200);
  });

  it("agent cannot update task assigned to another", async () => {
    mocks.getById.mockResolvedValue({ ...SAMPLE_TASK, assignedTo: OTHER_USER_ID });
    const res = await agentApp.request(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hack" }),
    });
    expect(res.status).toBe(404);
  });

  it("agent cannot reassign task to another user", async () => {
    mocks.getById.mockResolvedValue({ ...SAMPLE_TASK, assignedTo: AGENT_USER.id });
    const res = await agentApp.request(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo: OTHER_USER_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when task does not exist", async () => {
    mocks.getById.mockResolvedValue(null);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("manager can delete a task", async () => {
    mocks.delete.mockResolvedValue(SAMPLE_TASK);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deleted).toBe(true);
  });

  it("agent cannot delete a task", async () => {
    const res = await agentApp.request(`/api/tasks/${TASK_ID}`, { method: "DELETE" });
    expect(res.status).toBe(403);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for missing task", async () => {
    mocks.delete.mockResolvedValue(null);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tasks/:id/complete", () => {
  beforeEach(() => {
    mocks.getById.mockResolvedValue(SAMPLE_TASK);
  });

  it("marks task complete", async () => {
    mocks.complete.mockResolvedValue(SAMPLE_TASK);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}/complete`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith(TASK_ID);
  });

  it("returns 404 for missing task", async () => {
    mocks.complete.mockResolvedValue(null);
    const res = await managerApp.request(`/api/tasks/${TASK_ID}/complete`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tasks/:id/notes", () => {
  it("adds a note to a task", async () => {
    mocks.addNote.mockResolvedValue({
      ...SAMPLE_TASK,
      notes: [{ text: "Called", authorId: AGENT_USER.id }],
    });
    const res = await agentApp.request(`/api/tasks/${TASK_ID}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Called" }),
    });
    expect(res.status).toBe(201);
  });

  it("returns 404 when task does not exist", async () => {
    mocks.addNote.mockResolvedValue(null);
    const res = await agentApp.request(`/api/tasks/${TASK_ID}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Note" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects empty note text", async () => {
    const res = await agentApp.request(`/api/tasks/${TASK_ID}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/tasks/bulk", () => {
  beforeEach(() => {
    mocks.createNotification.mockResolvedValue(undefined);
  });

  it("manager can bulk complete tasks", async () => {
    mocks.bulkComplete.mockResolvedValue({ succeeded: [TASK_ID, TASK_ID_2], failed: [] });
    const res = await managerApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", taskIds: [TASK_ID, TASK_ID_2] }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.succeeded).toHaveLength(2);
  });

  it("manager can bulk delete tasks", async () => {
    mocks.bulkDelete.mockResolvedValue({ succeeded: [TASK_ID], failed: [] });
    const res = await managerApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", taskIds: [TASK_ID] }),
    });
    expect(res.status).toBe(200);
  });

  it("agent cannot bulk delete", async () => {
    const res = await agentApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", taskIds: [TASK_ID] }),
    });
    expect(res.status).toBe(403);
    expect(mocks.bulkDelete).not.toHaveBeenCalled();
  });

  it("agent cannot bulk reassign", async () => {
    const res = await agentApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reassign", taskIds: [TASK_ID], assignedTo: OTHER_USER_ID }),
    });
    expect(res.status).toBe(403);
    expect(mocks.bulkReassign).not.toHaveBeenCalled();
  });

  it("reassign requires assignedTo", async () => {
    const res = await managerApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reassign", taskIds: [TASK_ID] }),
    });
    expect(res.status).toBe(400);
  });

  it("bulk reassign sends notifications to new assignees", async () => {
    mocks.bulkReassign.mockResolvedValue({ succeeded: [TASK_ID], failed: [] });
    mocks.getByIds.mockResolvedValue([{ ...SAMPLE_TASK, assignedTo: OTHER_USER_ID }]);
    await managerApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reassign", taskIds: [TASK_ID], assignedTo: OTHER_USER_ID }),
    });
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });

  it("rejects empty taskIds array", async () => {
    const res = await managerApp.request("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", taskIds: [] }),
    });
    expect(res.status).toBe(400);
  });
});
