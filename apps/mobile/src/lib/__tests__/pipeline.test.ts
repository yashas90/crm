import {
  groupLeadsByStage,
  isClosedPipelineStageKey,
  normalizePipelineStatus,
  sumPipelineColumnValue,
} from "@/lib/pipeline";

const lead = (id: string, leadStatus: string, name: string, estimatedValue?: string | null) => ({
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
  estimatedValue: estimatedValue ?? null,
});

describe("groupLeadsByStage", () => {
  it("groups leads by exact leadStatus", () => {
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

  it("places unknown statuses in the first column fallback", () => {
    const board = groupLeadsByStage([lead("9", "archived", "Eve")]);
    expect(board.new.map((l) => l.id)).toEqual(["9"]);
  });

  it("maps qualified to site visit column", () => {
    const board = groupLeadsByStage([lead("5", "qualified", "Frank")]);
    expect(board.qualified.map((l) => l.id)).toEqual(["5"]);
    expect(normalizePipelineStatus("qualified")).toBe("qualified");
  });
});

describe("pipeline helpers", () => {
  it("detects closed stage keys", () => {
    expect(isClosedPipelineStageKey("won")).toBe(true);
    expect(isClosedPipelineStageKey("lost")).toBe(true);
    expect(isClosedPipelineStageKey("new")).toBe(false);
  });

  it("sums estimated values for a column", () => {
    const total = sumPipelineColumnValue([
      lead("1", "new", "A", "100000"),
      lead("2", "new", "B", "50000"),
      lead("3", "new", "C", null),
    ]);
    expect(total).toBe(150000);
  });
});
