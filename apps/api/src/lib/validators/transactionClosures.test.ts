import { describe, expect, it } from "vitest";
import { readTcfForm } from "./transactionClosures.js";

describe("readTcfForm product project", () => {
  it("keeps productName and projectId on the saved payload", () => {
    const form = readTcfForm({
      productName: "Nikoo",
      projectId: "project-nikoo",
    });
    expect(form.productName).toBe("Nikoo");
    expect(form.projectId).toBe("project-nikoo");
  });

  it("defaults projectId when an older draft only stored a product name", () => {
    const form = readTcfForm({ productName: "nikoo" });
    expect(form.productName).toBe("nikoo");
    expect(form.projectId).toBe("");
  });
});
