import { describe, expect, it } from "vitest";
import {
  appendTaskNote,
  endOfTodayIso,
  parseTaskNotes,
  startOfTodayIso,
} from "../lib/taskNotes.js";

describe("taskNotes", () => {
  it("parses empty and invalid notes as empty array", () => {
    expect(parseTaskNotes(null)).toEqual([]);
    expect(parseTaskNotes("")).toEqual([]);
    expect(parseTaskNotes("not-json")).toEqual([]);
    expect(parseTaskNotes("{}")).toEqual([]);
  });

  it("appends a note entry as JSON", () => {
    const raw = appendTaskNote(null, {
      text: "Called lead",
      authorId: "user-1",
      authorName: "Agent",
    });
    const entries = parseTaskNotes(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("Called lead");
    expect(entries[0]?.authorId).toBe("user-1");
    expect(entries[0]?.authorName).toBe("Agent");
    expect(entries[0]?.createdAt).toBeTruthy();
  });

  it("returns start and end of today as ISO strings", () => {
    const start = new Date(startOfTodayIso());
    const end = new Date(endOfTodayIso());
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end >= start).toBe(true);
  });
});
