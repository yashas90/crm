import { describe, expect, it } from "vitest";
import { escapeCsvCell, sanitiseCsvCell } from "./csv.js";
import { isNumericPhone, sanitizeLeadImportRow, stripHtmlTags } from "./sanitize.js";

describe("sanitiseCsvCell", () => {
  it("prefixes formula-like strings with a single quote", () => {
    expect(sanitiseCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitiseCsvCell("+919876543210")).toBe("'+919876543210");
    expect(sanitiseCsvCell("-summary")).toBe("'-summary");
    expect(sanitiseCsvCell("@evil")).toBe("'@evil");
  });

  it("leaves normal values unchanged", () => {
    expect(sanitiseCsvCell("John Doe")).toBe("John Doe");
    expect(sanitiseCsvCell(42)).toBe("42");
  });

  it("applies sanitisation inside escapeCsvCell", () => {
    expect(escapeCsvCell("=cmd|'/c calc'!A0")).toBe("'=cmd|'/c calc'!A0");
  });
});

describe("sanitizeLeadImportRow", () => {
  it("strips HTML from text fields", () => {
    const row = sanitizeLeadImportRow({
      firstName: "<b>Jane</b>",
      notes: "<script>x</script>Hello",
      phone: "9876543210",
    });
    expect(row.firstName).toBe("Jane");
    expect(row.notes).toBe("xHello");
  });

  it("validates numeric phone after normal separators", () => {
    expect(isNumericPhone("98765 43210")).toBe(true);
    expect(isNumericPhone("98765-43210")).toBe(true);
    expect(isNumericPhone("call-me")).toBe(false);
  });
});

describe("stripHtmlTags", () => {
  it("removes tags", () => {
    expect(stripHtmlTags("<a href='x'>link</a>")).toBe("link");
  });
});
