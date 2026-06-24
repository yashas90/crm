import { describe, expect, it } from "vitest";
import { listLeadsQuerySchema, updateLeadBodySchema } from "./leads.js";

describe("listLeadsQuerySchema", () => {
  const agentId = "550e8400-e29b-41d4-a716-446655440000";

  it("parses assignment history filters", () => {
    const parsed = listLeadsQuerySchema.safeParse({
      assignedTo: agentId,
      assignWithHistory: "true",
      assignedFrom: agentId,
      assignedBy: agentId,
      originalOwner: agentId,
      page: "1",
      pageSize: "50",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assignWithHistory).toBe(true);
      expect(parsed.data.assignedFrom).toBe(agentId);
      expect(parsed.data.assignedBy).toBe(agentId);
      expect(parsed.data.originalOwner).toBe(agentId);
    }
  });

  it("parses activity and tag preset filters", () => {
    const parsed = listLeadsQuerySchema.safeParse({
      tagPresets: "hot,warm",
      meetingDone: "true",
      siteVisitNotDone: "true",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tagPresets).toEqual(["hot", "warm"]);
      expect(parsed.data.meetingDone).toBe(true);
      expect(parsed.data.siteVisitNotDone).toBe(true);
    }
  });

  it("parses budget and area range filters", () => {
    const parsed = listLeadsQuerySchema.safeParse({
      minBudgetFrom: "1000000",
      minBudgetTo: "5000000",
      carpetAreaFrom: "800",
      builtUpAreaTo: "1200",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minBudgetFrom).toBe(1_000_000);
      expect(parsed.data.minBudgetTo).toBe(5_000_000);
      expect(parsed.data.carpetAreaFrom).toBe(800);
      expect(parsed.data.builtUpAreaTo).toBe(1200);
    }
  });

  it("parses geo filter coordinates", () => {
    const parsed = listLeadsQuerySchema.safeParse({
      latitude: "19.076",
      longitude: "72.8777",
      radiusKm: "10",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.latitude).toBeCloseTo(19.076);
      expect(parsed.data.longitude).toBeCloseTo(72.8777);
      expect(parsed.data.radiusKm).toBe(10);
    }
  });
});

describe("updateLeadBodySchema", () => {
  it("accepts not_interested status only", () => {
    const parsed = updateLeadBodySchema.safeParse({ leadStatus: "not_interested" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leadStatus).toBe("not_interested");
    }
  });

  it("accepts null nextFollowupAt to clear follow-up", () => {
    const parsed = updateLeadBodySchema.safeParse({
      leadStatus: "not_interested",
      nextFollowupAt: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nextFollowupAt).toBeNull();
    }
  });

  it("maps stage alias to leadStatus", () => {
    const parsed = updateLeadBodySchema.safeParse({ stage: "qualified" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leadStatus).toBe("qualified");
    }
  });

  it("accepts assignedTo for manager reassignment", () => {
    const parsed = updateLeadBodySchema.safeParse({
      leadStatus: "contacted",
      assignedTo: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assignedTo).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("rejects display labels instead of enum slugs", () => {
    const parsed = updateLeadBodySchema.safeParse({ leadStatus: "Not Interested" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leadStatus).toBe("not_interested");
    }
  });

  it("accepts legacy mobile status patch with nextFollowupAt null and statusLabel", () => {
    const parsed = updateLeadBodySchema.safeParse({
      leadStatus: "not_interested",
      nextFollowupAt: null,
      statusLabel: "Not Interested",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leadStatus).toBe("not_interested");
      expect(parsed.data.nextFollowupAt).toBeNull();
    }
  });

  it("ignores empty assignedTo from mobile", () => {
    const parsed = updateLeadBodySchema.safeParse({
      leadStatus: "not_interested",
      assignedTo: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assignedTo).toBeUndefined();
    }
  });
});
