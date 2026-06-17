import { beforeEach, describe, expect, it } from "vitest";
import { blockUser, decodeJwtSubject, isUserBlocked, unblockUser } from "./deactivatedUsers.js";

describe("deactivatedUsers blocklist", () => {
  beforeEach(() => {
    unblockUser("user-1");
  });

  it("blocks and unblocks user ids", () => {
    blockUser("user-1");
    expect(isUserBlocked("user-1")).toBe(true);
    unblockUser("user-1");
    expect(isUserBlocked("user-1")).toBe(false);
  });

  it("decodes jwt subject without verification", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-abc" })).toString("base64url");
    const token = `${header}.${payload}.sig`;
    expect(decodeJwtSubject(token)).toBe("user-abc");
  });
});
