import { describe, expect, it } from "vitest";
import { toMetaAdAccountGraphId } from "./metaGraphClient.js";

describe("toMetaAdAccountGraphId", () => {
  it("prefixes bare account ids with act_", () => {
    expect(toMetaAdAccountGraphId("123456789")).toBe("act_123456789");
  });

  it("leaves act_ ids unchanged", () => {
    expect(toMetaAdAccountGraphId("act_123456789")).toBe("act_123456789");
  });
});
