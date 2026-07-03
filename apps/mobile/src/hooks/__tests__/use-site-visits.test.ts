import {
  visitLeadName,
  visitLocation,
  visitStatusColor,
  visitStatusLabel,
} from "@/hooks/use-site-visits";

describe("site visit helpers", () => {
  const visit = {
    id: "v1",
    leadId: "l1",
    projectId: "p1",
    agentId: "a1",
    visitDate: "2026-07-03",
    visitTime: "10:30:00",
    duration: 60,
    status: "scheduled" as const,
    notes: null,
    propertyAddress: "MG Road",
    propertyLabel: "Sunrise Towers",
    lead: { id: "l1", firstName: "Ravi", lastName: "Kumar", phone: "+911111111111" },
    project: { id: "p1", name: "Sunrise Towers" },
    agent: { id: "a1", name: "Agent One" },
  };

  it("formats visit labels", () => {
    expect(visitLeadName(visit)).toBe("Ravi Kumar");
    expect(visitLocation(visit)).toBe("Sunrise Towers");
    expect(visitStatusLabel("no_show")).toBe("no show");
  });

  it("maps status colors", () => {
    expect(visitStatusColor("scheduled")).toBe("#16a34a");
    expect(visitStatusColor("cancelled")).toBe("#dc2626");
  });
});
