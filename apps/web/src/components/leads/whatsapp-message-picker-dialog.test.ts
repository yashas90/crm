import { describe, expect, it } from "vitest";
import { buildMessageTemplateVariables } from "./whatsapp-message-picker-dialog";

describe("buildMessageTemplateVariables", () => {
  it("prefers linked unit project details over lead project name", () => {
    const vars = buildMessageTemplateVariables({
      leadName: "Rahul Sharma",
      agentName: "Priya",
      projectName: "Old Project",
      linkedUnit: {
        id: "u1",
        unitNumber: "B-101",
        floor: 1,
        bedrooms: 2,
        areaSqFt: "1200",
        status: "available",
        priceListedRs: "5000000",
        projectId: "p1",
        projectName: "Skyline Residency",
      },
    });

    expect(vars.projectName).toBe("Skyline Residency");
    expect(vars.unitNumber).toBe("B-101");
    expect(vars.priceListedRs).toBe("5000000");
  });
});
