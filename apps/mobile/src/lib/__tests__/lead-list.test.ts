import { flattenLeadPages, resolveNextLeadPage } from "../lead-list";

function row(id: string, leadCode: string) {
  return { id, leadCode };
}

describe("lead list pages", () => {
  it("drops duplicate ids within a page and does not re-append ids from a second page", () => {
    const pages = [
      {
        items: [row("a", "PROP-11570"), row("a", "PROP-11570"), row("b", "PROP-2")],
      },
      {
        items: [row("b", "PROP-2"), row("a", "PROP-11570")],
      },
    ];

    expect(flattenLeadPages(pages).map((lead) => lead.id)).toEqual(["a", "b"]);
  });

  it("still appends a distinct lead from the next page", () => {
    const pages = [
      { items: [row("a", "PROP-11570")] },
      { items: [row("c", "PROP-20000"), row("a", "PROP-11570")] },
    ];

    expect(flattenLeadPages(pages).map((lead) => lead.id)).toEqual(["a", "c"]);
  });

  it("keeps different lead ids that share a display code", () => {
    const pages = [{ items: [row("id-1", "PROP-11570"), row("id-2", "PROP-11570")] }];

    expect(flattenLeadPages(pages).map((lead) => lead.id)).toEqual(["id-1", "id-2"]);
  });

  it("replaces the list on refresh instead of keeping previously appended copies", () => {
    const refreshed = flattenLeadPages([{ items: [row("a", "PROP-11570"), row("b", "PROP-2")] }]);

    expect(refreshed.map((lead) => lead.id)).toEqual(["a", "b"]);
  });

  it("stops the next fetch when the latest page only repeats ids already present", () => {
    const last = { items: [row("a", "PROP-11570")], page: 2, pageSize: 1, total: 127 };
    const pages = [{ items: [row("a", "PROP-11570")] }, last];

    expect(resolveNextLeadPage(last, pages, [1, 2])).toBeUndefined();
  });

  it("requests another page when the latest page contains a new lead id", () => {
    const last = { items: [row("b", "PROP-2")], page: 2, pageSize: 1, total: 127 };
    const pages = [{ items: [row("a", "PROP-1")] }, last];

    expect(resolveNextLeadPage(last, pages, [1, 2])).toBe(3);
  });

  it("does not request a page param that was already loaded", () => {
    const last = { items: [row("b", "PROP-2")], page: 1, pageSize: 1, total: 10 };
    const pages = [{ items: [row("a", "PROP-1")] }, last];

    expect(resolveNextLeadPage(last, pages, [1, 2])).toBeUndefined();
  });
});
