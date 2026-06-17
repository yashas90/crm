import { groupLeadsByStage, normalizePipelineStatus } from "@/lib/pipeline";

const lead = (id: string, leadStatus: string, name: string) => ({
  id,
  firstName: name,
  lastName: "",
  phone: null,
  leadStatus,
  temperature: null,
  email: null,
  city: null,
  notes: null,
  nextFollowupAt: null,
});

describe("groupLeadsByStage", () => {
  it("groups leads by leadStatus", () => {
    const board = groupLeadsByStage([
      lead("1", "new", "Alice"),
      lead("2", "contacted", "Bob"),
      lead("3", "negotiation", "Carol"),
      lead("4", "won", "Dan"),
    ]);

    expect(board.new.map((l) => l.id)).toEqual(["1"]);
    expect(board.contacted.map((l) => l.id)).toEqual(["2"]);
    expect(board.negotiation.map((l) => l.id)).toEqual(["3"]);
    expect(board.won.map((l) => l.id)).toEqual(["4"]);
    expect(board.lost).toHaveLength(0);
  });

  it("places unknown statuses in new", () => {
    const board = groupLeadsByStage([lead("9", "archived", "Eve")]);
    expect(board.new.map((l) => l.id)).toEqual(["9"]);
    expect(board.new[0]?.leadStatus).toBe("new");
  });

  it("maps qualified to site visit column", () => {
    const board = groupLeadsByStage([lead("5", "qualified", "Frank")]);
    expect(board.qualified.map((l) => l.id)).toEqual(["5"]);
    expect(normalizePipelineStatus("qualified")).toBe("qualified");
  });
});
