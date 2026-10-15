import { describe, expect, it } from "vitest";
import { orderRowsByIds } from "./leadListRows.js";

describe("orderRowsByIds", () => {
  it("drops duplicate ids from a joined page and does not re-append ids already listed", () => {
    const rows = [
      { id: "a", leadCode: "PROP-11570" },
      { id: "a", leadCode: "PROP-11570" },
      { id: "b", leadCode: "PROP-2" },
      { id: "a", leadCode: "PROP-11570" },
    ];

    expect(orderRowsByIds(["a", "b", "a"], rows).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("keeps a later page's new id and leaves a repeated id out", () => {
    const first = orderRowsByIds(["a"], [{ id: "a", leadCode: "PROP-11570" }]);
    const second = orderRowsByIds(
      ["b", "a"],
      [
        { id: "b", leadCode: "PROP-20000" },
        { id: "a", leadCode: "PROP-11570" },
        { id: "a", leadCode: "PROP-11570" },
      ],
    );
    const seen = new Set(first.map((row) => row.id));
    const appended = second.filter((row) => !seen.has(row.id));

    expect(appended.map((row) => row.id)).toEqual(["b"]);
  });

  it("does not merge different lead ids that share a display code", () => {
    const rows = [
      { id: "id-1", leadCode: "PROP-11570" },
      { id: "id-2", leadCode: "PROP-11570" },
    ];

    expect(orderRowsByIds(["id-1", "id-2"], rows).map((row) => row.id)).toEqual(["id-1", "id-2"]);
  });
});
