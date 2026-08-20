import { describe, expect, it } from "vitest";
import { deleteUserSchema } from "./users.js";

describe("deleteUserSchema", () => {
  it("defaults reassignToUserIds to an empty list", () => {
    const parsed = deleteUserSchema.parse({});
    expect(parsed.reassignToUserIds).toEqual([]);
  });

  it("dedupes assignee ids", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const parsed = deleteUserSchema.parse({ reassignToUserIds: [id, id] });
    expect(parsed.reassignToUserIds).toEqual([id]);
  });

  it("rejects invalid uuids", () => {
    expect(() => deleteUserSchema.parse({ reassignToUserIds: ["not-a-uuid"] })).toThrow();
  });
});
