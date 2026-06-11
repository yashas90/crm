import { describe, expect, it } from "vitest";
import { parseCsvText, parseLeadsCsv } from "./parse-leads-csv";

describe("parseCsvText", () => {
  it("parses quoted fields with commas", () => {
    const rows = parseCsvText('a,b\n"hello, world",2');
    expect(rows).toEqual([
      ["a", "b"],
      ["hello, world", "2"],
    ]);
  });
});

describe("parseLeadsCsv", () => {
  it("maps common header aliases and splits full name", () => {
    const csv = `Name,Mobile,Email,City
Jane Doe,9876543210,jane@test.com,Pune`;

    const result = parseLeadsCsv(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      phone: "9876543210",
      email: "jane@test.com",
      city: "Pune",
    });
  });

  it("reports rows missing required fields", () => {
    const csv = `firstName,phone
,99999`;

    const result = parseLeadsCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.parseErrors[0]?.row).toBe(2);
  });
});
