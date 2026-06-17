import { normalizeRole } from "@/lib/auth";
import { roleFromJwt } from "@/lib/jwt";

describe("jwt role helpers", () => {
  it("extracts role from JWT payload", () => {
    const payload = btoa(JSON.stringify({ sub: "u1", role: "manager" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `header.${payload}.signature`;
    expect(roleFromJwt(token)).toBe("manager");
  });

  it("normalizes unknown roles to agent", () => {
    expect(normalizeRole("superuser")).toBe("agent");
    expect(normalizeRole("admin")).toBe("admin");
  });
});
