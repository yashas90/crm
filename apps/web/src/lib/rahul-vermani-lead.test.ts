import { isRahulVermaniLead } from "@/lib/rahul-vermani-lead";
import { describe, expect, it } from "vitest";

describe("isRahulVermaniLead", () => {
  it("matches by phone ending in 8697666260", () => {
    expect(
      isRahulVermaniLead({
        firstName: "Rahul",
        lastName: "vermani",
        phone: "+918697666260",
      }),
    ).toBe(true);
  });

  it("does not match other leads", () => {
    expect(
      isRahulVermaniLead({
        firstName: "Vikram",
        lastName: "Reddy",
        phone: "+919900000001",
      }),
    ).toBe(false);
  });
});
