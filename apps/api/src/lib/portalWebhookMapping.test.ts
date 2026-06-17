import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_FIELD_MAPPINGS } from "./portalWebhookDefaults.js";
import { applyPortalFieldMapping, splitFullName } from "./portalWebhookMapping.js";

describe("applyPortalFieldMapping", () => {
  it("maps 99acres payload fields", () => {
    const mapped = applyPortalFieldMapping(
      {
        sender_name: "Rahul Sharma",
        sender_phone: "9876543210",
        sender_email: "rahul@example.com",
        message: "Interested",
        property_name: "Sunrise Heights",
      },
      DEFAULT_PORTAL_FIELD_MAPPINGS["99acres"],
    );

    expect(mapped).toEqual({
      name: "Rahul Sharma",
      phone: "9876543210",
      email: "rahul@example.com",
      message: "Interested",
      projectInterest: "Sunrise Heights",
    });
  });

  it("maps MagicBricks payload fields", () => {
    const mapped = applyPortalFieldMapping(
      {
        Name: "Priya Patel",
        Mobile: "8765432109",
        Email: "priya@example.com",
        Message: "Call me",
        Project: "Green Valley",
      },
      DEFAULT_PORTAL_FIELD_MAPPINGS.magicbricks,
    );

    expect(mapped.name).toBe("Priya Patel");
    expect(mapped.phone).toBe("8765432109");
    expect(mapped.projectInterest).toBe("Green Valley");
  });
});

describe("splitFullName", () => {
  it("splits first and last name", () => {
    expect(splitFullName("Rahul Sharma")).toEqual({
      firstName: "Rahul",
      lastName: "Sharma",
    });
  });

  it("uses Unknown for empty name", () => {
    expect(splitFullName("")).toEqual({ firstName: "Unknown", lastName: "" });
  });
});
