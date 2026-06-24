import { normalizeRole } from "@/lib/auth";
import { decodeJwtPayload, isTokenExpired, roleFromJwt } from "@/lib/jwt";

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${body}.sig`;
}

describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const token = makeToken({ sub: "user-1", role: "agent" });
    const payload = decodeJwtPayload(token);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.role).toBe("agent");
  });

  it("returns null for fewer than 3 parts", () => {
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("noparts")).toBeNull();
  });

  it("returns null for garbled base64", () => {
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
  });
});

describe("roleFromJwt", () => {
  it("extracts role from payload", () => {
    const token = makeToken({ sub: "u1", role: "manager" });
    expect(roleFromJwt(token)).toBe("manager");
  });

  it("returns null when role is missing", () => {
    const token = makeToken({ sub: "u1" });
    expect(roleFromJwt(token)).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("returns false for token with future exp", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for already-expired token", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 100 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true within the buffer window", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 20 });
    expect(isTokenExpired(token, 30)).toBe(true);
  });

  it("returns false when no exp claim", () => {
    const token = makeToken({ sub: "u1" });
    expect(isTokenExpired(token)).toBe(false);
  });
});

describe("normalizeRole", () => {
  it("normalizes unknown roles to agent", () => {
    expect(normalizeRole("superuser")).toBe("agent");
    expect(normalizeRole("viewer")).toBe("agent");
  });

  it("passes through admin and manager", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("manager")).toBe("manager");
  });
});
