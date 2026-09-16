import { describe, expect, it } from "vitest";
import { parseSpreadsheetBuffer } from "./parseSpreadsheet.js";

describe("parseSpreadsheetBuffer", () => {
  it("parses CSV contact lists", () => {
    const csv = "Name,Phone,City,Budget\nPriya,9876543210,Bengaluru,80L\n";
    const parsed = parseSpreadsheetBuffer(Buffer.from(csv, "utf8"), "contacts.csv");
    expect(parsed.headers).toEqual(["Name", "Phone", "City", "Budget"]);
    expect(parsed.rows[0]).toEqual(["Priya", "9876543210", "Bengaluru", "80L"]);
  });
});
