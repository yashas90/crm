import { describe, expect, it } from "vitest";
import { applyAdvancedLeadFilters } from "./applyAdvancedLeadFilters.js";

const AGENT_A = "550e8400-e29b-41d4-a716-446655440001";
const AGENT_B = "550e8400-e29b-41d4-a716-446655440002";
const AGENT_C = "550e8400-e29b-41d4-a716-446655440003";

describe("applyAdvancedLeadFilters", () => {
  it("adds assignment history clause when assignWithHistory and assignedTo", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters(
      { assignedTo: AGENT_A, assignWithHistory: true },
      clauses as never,
    );
    expect(clauses).toHaveLength(1);
  });

  it("does not add assignment history clause without assignWithHistory", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters({ assignedTo: AGENT_A }, clauses as never);
    expect(clauses).toHaveLength(0);
  });

  it("adds assignedFrom, assignedBy, and originalOwner clauses", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters(
      {
        assignedFrom: AGENT_A,
        assignedBy: AGENT_B,
        originalOwner: AGENT_C,
      },
      clauses as never,
    );
    expect(clauses).toHaveLength(3);
  });

  it("adds tag preset clause for hot preset", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters({ tagPresets: ["hot"] }, clauses as never);
    expect(clauses).toHaveLength(1);
  });

  it("adds meeting and site visit activity clauses", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters(
      {
        meetingDone: true,
        siteVisitNotDone: true,
      },
      clauses as never,
    );
    expect(clauses).toHaveLength(1);
  });

  it("adds budget range clauses", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters(
      {
        minBudgetFrom: 1_000_000,
        minBudgetTo: 5_000_000,
        maxBudgetFrom: 2_000_000,
        maxBudgetTo: 8_000_000,
      },
      clauses as never,
    );
    expect(clauses).toHaveLength(4);
  });

  it("adds geo radius clause when lat, lng, and radius are set", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters(
      {
        latitude: 19.076,
        longitude: 72.8777,
        radiusKm: 10,
      },
      clauses as never,
    );
    expect(clauses).toHaveLength(1);
  });

  it("skips geo radius when any coordinate is missing", () => {
    const clauses: unknown[] = [];
    applyAdvancedLeadFilters({ latitude: 19.076, longitude: 72.8777 }, clauses as never);
    expect(clauses).toHaveLength(0);
  });
});
