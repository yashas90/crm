import { describe, expect, it } from "vitest";
import { parseContactFile } from "./parseSpreadsheet.js";
import { chunkRows, parseBudget } from "./sanitize.js";
import { scanUploadBuffer } from "./virusScan.js";

describe("scanUploadBuffer", () => {
  it("rejects executables, scripts, and the EICAR marker", () => {
    expect(scanUploadBuffer("leads.csv", Buffer.from("MZ executable")).ok).toBe(false);
    expect(scanUploadBuffer("leads.csv", Buffer.from("#!/bin/sh\necho")).ok).toBe(false);
    expect(
      scanUploadBuffer("leads.csv", Buffer.from("name,phone\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE\n"))
        .ok,
    ).toBe(false);
    expect(scanUploadBuffer("book.xlsx", Buffer.from("PK\u0003\u0004vbaproject.bin")).ok).toBe(
      false,
    );
  });

  it("accepts a plain csv", () => {
    const result = scanUploadBuffer("leads.csv", Buffer.from("name,phone\nA,9876543210\n"));
    expect(result.ok).toBe(true);
  });
});

describe("parseContactFile", () => {
  it("parses quoted csv rows", () => {
    const parsed = parseContactFile(
      "leads.csv",
      Buffer.from('name,phone,city\n"Rao, Amit",9876543210,Bangalore\n'),
    );
    expect(parsed.rows).toEqual([{ name: "Rao, Amit", phone: "9876543210", city: "Bangalore" }]);
  });
});

describe("upload helpers", () => {
  it("chunks 1200 rows into 500s", () => {
    expect(
      chunkRows(Array.from({ length: 1200 }, (_, i) => i)).map((chunk) => chunk.length),
    ).toEqual([500, 500, 200]);
  });

  it("parses lakh and crore budgets", () => {
    expect(parseBudget("50L").amount).toBe(5_000_000);
    expect(parseBudget("1.2Cr").amount).toBe(12_000_000);
  });
});
