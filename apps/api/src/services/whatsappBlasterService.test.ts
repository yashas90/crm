import { describe, expect, it } from "vitest";
import { whatsappBlasterService } from "../services/whatsappBlasterService.js";

describe("whatsappBlasterService.mapRows", () => {
  it("maps and validates Indian numbers", () => {
    const result = whatsappBlasterService.mapRows(
      ["Name", "Phone"],
      [
        ["Asha", "9876543210"],
        ["Dup", "9876543210"],
        ["Bad", "000"],
      ],
      { name: "Name", phone: "Phone" },
    );
    expect(result.valid).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.contacts[0]?.formattedPhone).toBe("+919876543210");
  });
});
