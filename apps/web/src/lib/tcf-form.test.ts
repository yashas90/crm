import { describe, expect, it } from "vitest";
import {
  UNMATCHED_PRODUCT_VALUE,
  asTcfForm,
  emptyTcfForm,
  resolveTcfProduct,
  tcfProductSelectValue,
} from "./tcf-form";

const projects = [
  { id: "project-nikoo", name: "Nikoo" },
  { id: "project-other", name: "Other Homes" },
];

describe("tcf product project mapping", () => {
  it("keeps productName and projectId when a TCF is loaded", () => {
    const form = asTcfForm({
      productName: "Nikoo",
      projectId: "project-nikoo",
      client: { primaryApplicant: "Asha" },
    });
    expect(form.productName).toBe("Nikoo");
    expect(form.projectId).toBe("project-nikoo");
    expect(form.client.primaryApplicant).toBe("Asha");
    expect(form.segment).toBe("Primary");
  });

  it("keeps an unmatched product name so older drafts stay visible", () => {
    const form = asTcfForm({ productName: "nikoo" });
    expect(form.productName).toBe("nikoo");
    expect(form.projectId).toBe("");
    expect(emptyTcfForm().projectId).toBe("");
  });

  it("maps a selected project onto both payload fields", () => {
    expect(resolveTcfProduct({ productName: "", projectId: "project-nikoo" }, projects)).toEqual({
      productName: "Nikoo",
      projectId: "project-nikoo",
    });
    expect(resolveTcfProduct({ productName: "nikoo", projectId: "" }, projects)).toEqual({
      productName: "Nikoo",
      projectId: "project-nikoo",
    });
  });

  it("leaves a stored name in place when no project matches", () => {
    expect(
      resolveTcfProduct({ productName: "Legacy tower", projectId: "missing" }, projects),
    ).toEqual({
      productName: "Legacy tower",
      projectId: "missing",
    });
    expect(
      tcfProductSelectValue({ productName: "Legacy tower", projectId: "missing" }, projects, true),
    ).toBe(UNMATCHED_PRODUCT_VALUE);
    expect(
      tcfProductSelectValue({ productName: "Nikoo", projectId: "project-nikoo" }, projects, true),
    ).toBe("project-nikoo");
  });
});
