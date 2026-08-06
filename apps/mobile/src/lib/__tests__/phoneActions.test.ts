import { isMaskedPhoneDisplay, normalizeTelPhone } from "@/lib/phoneActions";

describe("normalizeTelPhone", () => {
  it("keeps full Indian mobiles", () => {
    expect(normalizeTelPhone("+919876543210")).toBe("+919876543210");
    expect(normalizeTelPhone("9876543210")).toBe("9876543210");
  });

  it("rejects masked display numbers so dialer does not get 5 digits", () => {
    expect(isMaskedPhoneDisplay("98XXXXX210")).toBe(true);
    expect(normalizeTelPhone("98XXXXX210")).toBe("");
    expect(normalizeTelPhone("98xxxxx210")).toBe("");
  });
});
