import { beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";

async function loginToken(
  email = "admin@propninja.local",
  password = "admin",
): Promise<{ token: string; status: number }> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { token: string } };
  return { token: json.data?.token ?? "", status: res.status };
}

async function dbReachable(token: string) {
  const res = await app.request("/api/leads?page=1&pageSize=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

async function createAssignedLead(
  adminToken: string,
  assignToUserId: string,
  suffix: string,
): Promise<string> {
  const phone = `+9190${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1000)}`;
  const res = await app.request("/api/leads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firstName: "TCF",
      lastName: suffix,
      phone,
    }),
  });
  expect(res.status).toBe(201);
  const json = (await res.json()) as { data: { id: string } };
  const leadId = json.data.id;

  const assignRes = await app.request(`/api/leads/${leadId}/assign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: assignToUserId }),
  });
  expect(assignRes.status).toBe(200);

  return leadId;
}

async function userIdForToken(token: string): Promise<string> {
  const res = await app.request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

async function addLeadNote(token: string, leadId: string, text: string) {
  const res = await app.request(`/api/leads/${leadId}/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  expect(res.status).toBe(201);
}

describe("API integration", () => {
  let token = "";
  let hasDb = false;

  beforeAll(async () => {
    process.env.VITEST = "true";
    const login = await loginToken();
    token = login.token;
    hasDb = login.status === 200 && (await dbReachable(token));
  });

  it("POST /api/auth/login returns token for active user", async ({ skip }) => {
    if (!hasDb) skip();

    const login = await loginToken("admin@propninja.local", "admin");
    expect(login.status).toBe(200);
    expect(login.token.length).toBeGreaterThan(0);

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${login.token}` },
    });
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { ok: boolean; data: { email: string } };
    expect(meJson.ok).toBe(true);
    expect(meJson.data.email).toBe("admin@propninja.local");
  });

  it("deactivated user's previously valid token returns 401", async ({ skip }) => {
    if (!hasDb) skip();

    const agentEmail = "agent1@demo.propninja";
    const agentLogin = await loginToken(agentEmail, "admin");
    expect(agentLogin.status).toBe(200);

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${agentLogin.token}` },
    });
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { data: { id: string } };
    const agentId = meJson.data.id;

    const deactivateRes = await app.request(`/api/users/${agentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });
    expect(deactivateRes.status).toBe(200);

    try {
      const blockedRes = await app.request("/api/auth/me", {
        headers: { Authorization: `Bearer ${agentLogin.token}` },
      });
      expect(blockedRes.status).toBe(401);
      const blockedJson = (await blockedRes.json()) as { error: { code: string } };
      expect(blockedJson.error.code).toBe("UNAUTHORIZED");
    } finally {
      const reactivateRes = await app.request(`/api/users/${agentId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: true }),
      });
      expect(reactivateRes.status).toBe(200);
    }
  });

  it("POST /api/leads creates a lead", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9199${Date.now().toString().slice(-8)}`;
    const res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Lead",
        phone,
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok: boolean; data: { id: string; phone: string } };
    expect(json.ok).toBe(true);
    expect(json.data.phone).toBe(phone);
  });

  it("PATCH /api/leads/:id accepts mobile Not Interested status payloads", async ({ skip }) => {
    if (!hasDb) skip();

    const agentLogin = await loginToken("agent1@demo.propninja", "admin");
    expect(agentLogin.status).toBe(200);
    const agentId = await userIdForToken(agentLogin.token);
    const leadId = await createAssignedLead(token, agentId, "NA-delay");

    const patchRes = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${agentLogin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadStatus: "Not Interested",
        nextFollowupAt: null,
        statusLabel: "Not Interested",
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      data: { leadStatus: string; assignedTo: string | null };
    };
    expect(patched.data.leadStatus).toBe("not_interested");
    // NA pool release is delayed — agent keeps assignment for the grace period.
    expect(patched.data.assignedTo).toBe(agentId);
  });

  it("POST /api/leads rejects duplicate phone", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9198${Date.now().toString().slice(-8)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const first = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({ firstName: "Dup", lastName: "One", phone }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({ firstName: "Dup", lastName: "Two", phone }),
    });
    expect(second.status).toBe(409);
    const json = (await second.json()) as { error: { code: string } };
    expect(json.error.code).toBe("LEAD_DUPLICATE_PHONE");
  });

  it("POST /api/leads/bulk-import creates multiple leads and skips duplicates", async ({
    skip,
  }) => {
    if (!hasDb) skip();

    const phoneA = `+9196${Date.now().toString().slice(-8)}`;
    const phoneB = `+9195${Date.now().toString().slice(-8)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await app.request("/api/leads/bulk-import", {
      method: "POST",
      headers,
      body: JSON.stringify({
        skipDuplicates: true,
        leads: [
          { firstName: "Bulk", lastName: "One", phone: phoneA, city: "Mumbai" },
          { firstName: "Bulk", lastName: "Two", phone: phoneB },
          { firstName: "Bulk", lastName: "Dup", phone: phoneA },
          { firstName: "", phone: "123" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data: {
        createdCount: number;
        updatedCount: number;
        skippedCount: number;
        failedCount: number;
      };
    };
    expect(json.data.createdCount).toBe(2);
    expect(json.data.updatedCount).toBe(1);
    expect(json.data.skippedCount).toBe(0);
    expect(json.data.failedCount).toBe(1);
  });

  it("POST /api/calls/log creates call and updates lastContactedAt", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9197${Date.now().toString().slice(-8)}`;
    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ firstName: "Call", lastName: "Target", phone }),
    });
    const created = (await createRes.json()) as {
      data: { id: string; lastContactedAt: string | null };
    };
    const leadId = created.data.id;
    expect(created.data.lastContactedAt).toBeNull();

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - 60_000);

    const logRes = await app.request("/api/calls/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_id: leadId,
        phone_number: phone,
        direction: "outgoing",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: 60,
        outcome: "answered",
        source: "mobile-manual",
      }),
    });
    expect(logRes.status).toBe(201);

    const leadRes = await app.request(`/api/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const leadJson = (await leadRes.json()) as { data: { lastContactedAt: string | null } };
    expect(leadJson.data.lastContactedAt).not.toBeNull();
  });

  describe("POST /api/calls/log follow-up tasks", () => {
    async function createLeadForCall() {
      const phone = `+9197${Date.now().toString().slice(-8)}`;
      const createRes = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firstName: "Follow", lastName: "Up", phone }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { data: { id: string } };
      return { leadId: created.data.id, phone };
    }

    async function logCallWithOutcome(
      leadId: string,
      phone: string,
      outcome: string,
      endedAt: Date,
    ) {
      const startedAt = new Date(endedAt.getTime() - 60_000);
      return app.request("/api/calls/log", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: leadId,
          phone_number: phone,
          direction: "outgoing",
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: 60,
          outcome,
          source: "mobile-manual",
        }),
      });
    }

    async function tasksForLead(leadId: string) {
      const res = await app.request(`/api/tasks?leadId=${leadId}&pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      return (await res.json()) as {
        data: {
          items: Array<{
            assignedTo: string | null;
            leadId: string | null;
            priority: string;
            dueAt: string | null;
          }>;
        };
      };
    }

    it("no_answer does not auto-create follow-up task", async ({ skip }) => {
      if (!hasDb) skip();

      const { leadId, phone } = await createLeadForCall();
      const endedAt = new Date("2026-06-16T14:30:00.000Z");

      const logRes = await logCallWithOutcome(leadId, phone, "no_answer", endedAt);
      expect(logRes.status).toBe(201);
      const logJson = (await logRes.json()) as {
        data: { followUpTask: unknown };
      };
      expect(logJson.data.followUpTask).toBeNull();

      const tasksJson = await tasksForLead(leadId);
      expect(tasksJson.data.items).toHaveLength(0);
    });

    it("busy does not auto-create follow-up task", async ({ skip }) => {
      if (!hasDb) skip();

      const { leadId, phone } = await createLeadForCall();
      const endedAt = new Date();

      const logRes = await logCallWithOutcome(leadId, phone, "busy", endedAt);
      expect(logRes.status).toBe(201);

      const tasksJson = await tasksForLead(leadId);
      expect(tasksJson.data.items).toHaveLength(0);
    });

    it("left_voicemail does not auto-create follow-up task", async ({ skip }) => {
      if (!hasDb) skip();

      const { leadId, phone } = await createLeadForCall();
      const endedAt = new Date("2026-06-16T09:00:00.000Z");

      const logRes = await logCallWithOutcome(leadId, phone, "left_voicemail", endedAt);
      expect(logRes.status).toBe(201);
      const logJson = (await logRes.json()) as {
        data: { followUpTask: unknown };
      };
      expect(logJson.data.followUpTask).toBeNull();

      const tasksJson = await tasksForLead(leadId);
      expect(tasksJson.data.items).toHaveLength(0);
    });

    it("answered does not create follow-up task", async ({ skip }) => {
      if (!hasDb) skip();

      const { leadId, phone } = await createLeadForCall();
      const endedAt = new Date();

      const logRes = await logCallWithOutcome(leadId, phone, "answered", endedAt);
      expect(logRes.status).toBe(201);
      const logJson = (await logRes.json()) as { data: { followUpTask: unknown } };
      expect(logJson.data.followUpTask).toBeNull();

      const tasksJson = await tasksForLead(leadId);
      expect(tasksJson.data.items).toHaveLength(0);
    });
  });

  describe("TCF lead authorization", () => {
    it("agent can access own lead consent but not another agent's", async ({ skip }) => {
      if (!hasDb) skip();

      const agent1Login = await loginToken("agent1@demo.propninja", "admin");
      const agent2Login = await loginToken("agent2@demo.propninja", "admin");
      expect(agent1Login.status).toBe(200);
      expect(agent2Login.status).toBe(200);

      const agent1Id = await userIdForToken(agent1Login.token);
      const agent2Id = await userIdForToken(agent2Login.token);

      const ownLeadId = await createAssignedLead(token, agent1Id, "Own");
      const otherLeadId = await createAssignedLead(token, agent2Id, "Other");

      const ownGet = await app.request(`/api/tcf/leads/${ownLeadId}`, {
        headers: { Authorization: `Bearer ${agent1Login.token}` },
      });
      expect(ownGet.status).toBe(200);

      const otherGet = await app.request(`/api/tcf/leads/${otherLeadId}`, {
        headers: { Authorization: `Bearer ${agent1Login.token}` },
      });
      expect(otherGet.status).toBe(403);
      const otherGetJson = (await otherGet.json()) as { error: { code: string } };
      expect(otherGetJson.error.code).toBe("FORBIDDEN");

      const ownUpsert = await app.request("/api/tcf/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent1Login.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: ownLeadId,
          consent_type: "call",
          consented: true,
          source: "integration-test",
        }),
      });
      expect(ownUpsert.status).toBe(201);

      const otherUpsert = await app.request("/api/tcf/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent1Login.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: otherLeadId,
          consent_type: "call",
          consented: true,
          source: "integration-test",
        }),
      });
      expect(otherUpsert.status).toBe(403);
    });

    it("admin and manager can access any lead consent", async ({ skip }) => {
      if (!hasDb) skip();

      const managerLogin = await loginToken("manager@demo.propninja", "admin");
      const agentLogin = await loginToken("agent1@demo.propninja", "admin");
      expect(managerLogin.status).toBe(200);
      expect(agentLogin.status).toBe(200);

      const agentId = await userIdForToken(agentLogin.token);
      const leadId = await createAssignedLead(token, agentId, "Mgr");

      const managerGet = await app.request(`/api/tcf/consent/${leadId}`, {
        headers: { Authorization: `Bearer ${managerLogin.token}` },
      });
      expect(managerGet.status).toBe(200);

      const adminGet = await app.request(`/api/tcf/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(adminGet.status).toBe(200);

      const managerUpsert = await app.request("/api/tcf/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managerLogin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: leadId,
          consent_type: "sms",
          consented: true,
          source: "integration-test",
        }),
      });
      expect(managerUpsert.status).toBe(201);

      const consentJson = (await managerUpsert.json()) as { data: { id: string } };
      const revokeRes = await app.request(`/api/tcf/${consentJson.data.id}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(revokeRes.status).toBe(200);
    });
  });

  describe("recent lead activities scope", () => {
    it("agent only sees activities for assigned leads", async ({ skip }) => {
      if (!hasDb) skip();

      const agentLogin = await loginToken("agent1@demo.propninja", "admin");
      expect(agentLogin.status).toBe(200);

      const agentId = await userIdForToken(agentLogin.token);
      const agent2Id = await userIdForToken(
        (await loginToken("agent2@demo.propninja", "admin")).token,
      );

      const ownLeadId = await createAssignedLead(token, agentId, "ActOwn");
      const otherLeadId = await createAssignedLead(token, agent2Id, "ActOther");

      await addLeadNote(token, ownLeadId, "Recent activity on agent1 lead");
      await addLeadNote(token, otherLeadId, "Recent activity on agent2 lead");

      const res = await app.request("/api/leads/activities/recent?limit=50", {
        headers: { Authorization: `Bearer ${agentLogin.token}` },
      });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ leadId: string }> };
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data.some((activity) => activity.leadId === ownLeadId)).toBe(true);
      expect(json.data.some((activity) => activity.leadId === otherLeadId)).toBe(false);
    });

    it("admin sees org-wide recent activity", async ({ skip }) => {
      if (!hasDb) skip();

      const agentId = await userIdForToken(
        (await loginToken("agent1@demo.propninja", "admin")).token,
      );
      const agent2Id = await userIdForToken(
        (await loginToken("agent2@demo.propninja", "admin")).token,
      );

      const ownLeadId = await createAssignedLead(token, agentId, "ActAdm1");
      const otherLeadId = await createAssignedLead(token, agent2Id, "ActAdm2");

      await addLeadNote(token, ownLeadId, "Admin-visible activity on agent1 lead");
      await addLeadNote(token, otherLeadId, "Admin-visible activity on agent2 lead");

      const res = await app.request("/api/leads/activities/recent?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ leadId: string }> };
      expect(json.data.some((activity) => activity.leadId === ownLeadId)).toBe(true);
      expect(json.data.some((activity) => activity.leadId === otherLeadId)).toBe(true);
    });
  });

  it("re-enquired scope lists leads reopened from lost/won", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9188${Date.now().toString().slice(-8)}`;
    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ firstName: "Re", lastName: "Enquire", phone }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    const leadId = created.data.id;

    const lostRes = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadStatus: "lost" }),
    });
    expect(lostRes.status).toBe(200);

    const reopenRes = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leadStatus: "new" }),
    });
    expect(reopenRes.status).toBe(200);

    const listRes = await app.request("/api/leads?reEnquiredOnly=true&page=1&pageSize=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: { items: Array<{ id: string }> } };
    expect(listJson.data.items.some((lead) => lead.id === leadId)).toBe(true);

    const countsRes = await app.request("/api/leads/scope-counts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(countsRes.status).toBe(200);
    const countsJson = (await countsRes.json()) as { data: { "re-enquired": number; all: number } };
    expect(countsJson.data["re-enquired"]).toBeGreaterThan(0);
    expect(countsJson.data["re-enquired"]).toBeLessThanOrEqual(countsJson.data.all);
  });

  it("GET /api/leads filters by overlapping tags", async ({ skip }) => {
    if (!hasDb) skip();

    const suffix = Date.now().toString().slice(-8);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const taggedRes = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: "Tagged",
        lastName: "Lead",
        phone: `+9197${suffix}`,
        tags: ["filter_tag_a", "shared_tag"],
      }),
    });
    expect(taggedRes.status).toBe(201);

    const otherRes = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: "Other",
        lastName: "Lead",
        phone: `+9196${suffix}`,
        tags: ["filter_tag_b"],
      }),
    });
    expect(otherRes.status).toBe(201);

    const matchRes = await app.request(
      "/api/leads?tags=filter_tag_a,shared_tag&page=1&pageSize=50",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(matchRes.status).toBe(200);
    const matchJson = (await matchRes.json()) as {
      data: { items: Array<{ firstName: string; tags: string[] | null }> };
    };
    expect(matchJson.data.items.some((lead) => lead.firstName === "Tagged")).toBe(true);
    expect(matchJson.data.items.some((lead) => lead.firstName === "Other")).toBe(false);

    const overlapRes = await app.request(
      "/api/leads?tags=shared_tag,filter_tag_b&page=1&pageSize=50",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(overlapRes.status).toBe(200);
    const overlapJson = (await overlapRes.json()) as {
      data: { items: Array<{ firstName: string }> };
    };
    const names = overlapJson.data.items.map((lead) => lead.firstName);
    expect(names).toContain("Tagged");
    expect(names).toContain("Other");
  });

  it("PATCH /api/org updates safe organization fields", async ({ skip }) => {
    if (!hasDb) skip();

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const patchRes = await app.request("/api/org", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "PropNinja Demo Org",
        website: "https://demo.propninja.local",
        timezone: "Asia/Kolkata",
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await patchRes.json()) as {
      ok: boolean;
      data: { name: string; settings: Record<string, unknown> };
    };
    expect(patchJson.ok).toBe(true);
    expect(patchJson.data.name).toBe("PropNinja Demo Org");
    expect(patchJson.data.settings.website).toBe("https://demo.propninja.local");
    expect(patchJson.data.settings.timezone).toBe("Asia/Kolkata");

    const getRes = await app.request("/api/org", { headers: { Authorization: `Bearer ${token}` } });
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      data: { name: string; settings: Record<string, unknown> };
    };
    expect(getJson.data.settings.website).toBe("https://demo.propninja.local");
  });

  it("tasks CRUD with assigneeId=me, status=open, and PATCH complete", async ({ skip }) => {
    if (!hasDb) skip();

    const adminId = await userIdForToken(token);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const createRes = await app.request("/api/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Integration test task",
        description: "Follow up tomorrow",
        priority: "high",
        taskType: "call",
        assignedTo: adminId,
      }),
    });
    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as { data: { id: string; status: string } };
    const taskId = createJson.data.id;
    expect(createJson.data.status).toBe("pending");

    const listRes = await app.request("/api/tasks?assigneeId=me&status=open&page=1&pageSize=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      data: { items: Array<{ id: string; status: string }> };
    };
    expect(listJson.data.items.some((task) => task.id === taskId)).toBe(true);

    const noteRes = await app.request(`/api/tasks/${taskId}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Left voicemail" }),
    });
    expect(noteRes.status).toBe(201);
    const noteJson = (await noteRes.json()) as {
      data: { noteEntries: Array<{ text: string }> };
    };
    expect(noteJson.data.noteEntries[0]?.text).toBe("Left voicemail");

    const completeRes = await app.request(`/api/tasks/${taskId}/complete`, {
      method: "PATCH",
      headers,
    });
    expect(completeRes.status).toBe(200);
    const completeJson = (await completeRes.json()) as {
      data: { status: string; noteEntries: Array<{ text: string }> };
    };
    expect(completeJson.data.status).toBe("completed");
    expect(completeJson.data.noteEntries).toHaveLength(1);

    const bulkRes = await app.request("/api/tasks/bulk", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "delete", taskIds: [taskId] }),
    });
    expect(bulkRes.status).toBe(200);
    const bulkJson = (await bulkRes.json()) as { data: { succeeded: string[] } };
    expect(bulkJson.data.succeeded).toContain(taskId);
  });

  describe("message templates", () => {
    it("lists active templates for any authenticated user", async ({ skip }) => {
      if (!hasDb) skip();

      const agentLogin = await loginToken("agent1@demo.propninja", "admin");
      expect(agentLogin.status).toBe(200);

      const res = await app.request("/api/message-templates", {
        headers: { Authorization: `Bearer ${agentLogin.token}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { items: Array<{ name: string }> } };
      expect(Array.isArray(json.data.items)).toBe(true);
    });

    it("enforces admin/manager for create and patch, admin for delete", async ({ skip }) => {
      if (!hasDb) skip();

      const agentLogin = await loginToken("agent1@demo.propninja", "admin");
      const managerLogin = await loginToken("manager@demo.propninja", "admin");
      expect(agentLogin.status).toBe(200);
      expect(managerLogin.status).toBe(200);

      const body = {
        name: `Test Template ${Date.now()}`,
        content: "Hi {{leadName}} from {{agentName}}",
        category: "custom",
      };

      const agentCreate = await app.request("/api/message-templates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agentLogin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      expect(agentCreate.status).toBe(403);

      const managerCreate = await app.request("/api/message-templates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managerLogin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      expect(managerCreate.status).toBe(201);
      const created = (await managerCreate.json()) as { data: { id: string; name: string } };
      const templateId = created.data.id;

      const agentPatch = await app.request(`/api/message-templates/${templateId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${agentLogin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Updated by agent" }),
      });
      expect(agentPatch.status).toBe(403);

      const managerPatch = await app.request(`/api/message-templates/${templateId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${managerLogin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: `${created.data.name} (edited)` }),
      });
      expect(managerPatch.status).toBe(200);

      const managerDelete = await app.request(`/api/message-templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerLogin.token}` },
      });
      expect(managerDelete.status).toBe(403);

      const adminDelete = await app.request(`/api/message-templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(adminDelete.status).toBe(200);
      const deleted = (await adminDelete.json()) as { data: { isActive: boolean } };
      expect(deleted.data.isActive).toBe(false);
    });
  });
});
