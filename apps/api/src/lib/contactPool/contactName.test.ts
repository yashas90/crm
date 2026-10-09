import { describe, expect, it } from "vitest";
import { contactNameFromRow, isMissingContactName } from "./contactName.js";

describe("contactNameFromRow", () => {
  it("reads a name column", () => {
    expect(contactNameFromRow({ name: "Ravi Kumar", phone: "9845200837" })).toBe("Ravi Kumar");
  });

  it("joins first and last name columns from the leads import template", () => {
    expect(
      contactNameFromRow({
        firstname: "VINUTHA N",
        lastname: "",
        phone: "9535611256",
      }),
    ).toBe("VINUTHA N");
    expect(
      contactNameFromRow({
        "first name": "Sundara",
        "last name": "Reddy",
        phone: "8660355767",
      }),
    ).toBe("Sundara Reddy");
  });

  it("keeps Unknown only when no name was provided", () => {
    expect(contactNameFromRow({ phone: "9945862229" })).toBe("Unknown");
    expect(contactNameFromRow({ firstname: "Unknown", lastname: "" })).toBe("Unknown");
    expect(isMissingContactName("Unknown")).toBe(true);
    expect(isMissingContactName("VINUTHA N")).toBe(false);
  });
});
