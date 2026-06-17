import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordReset = vi.fn();
const validatePasswordResetToken = vi.fn();
const completePasswordReset = vi.fn();

vi.mock("../services/passwordResetService.js", () => ({
  requestPasswordReset,
  validatePasswordResetToken,
  completePasswordReset,
}));

describe("password reset auth routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { authRoutes } = await import("./auth.js");
    app = new Hono();
    app.route("/api/auth", authRoutes);
  });

  it("POST /forgot-password always returns 200", async () => {
    requestPasswordReset.mockResolvedValue(undefined);

    const res = await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing@demo.test" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { message: string } };
    expect(body.ok).toBe(true);
    expect(body.data.message).toContain("If that email is registered");
  });

  it("GET /reset-password/:token returns email for valid token", async () => {
    validatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: "agent@demo.test",
      userId: "user-1",
      tokenId: "token-1",
    });

    const token = "00000000-0000-4000-8000-000000000001";
    const res = await app.request(`/api/auth/reset-password/${token}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { valid: boolean; email: string } };
    expect(body.data).toEqual({ valid: true, email: "agent@demo.test" });
  });

  it("GET /reset-password/:token returns 400 for invalid token", async () => {
    validatePasswordResetToken.mockResolvedValue({ valid: false, reason: "expired" });

    const token = "00000000-0000-4000-8000-000000000002";
    const res = await app.request(`/api/auth/reset-password/${token}`);
    expect(res.status).toBe(400);
  });

  it("POST /reset-password updates password for valid token", async () => {
    completePasswordReset.mockResolvedValue({ valid: true });

    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "00000000-0000-4000-8000-000000000003",
        newPassword: "strong-password",
      }),
    });

    expect(res.status).toBe(200);
    expect(completePasswordReset).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000003",
      "strong-password",
    );
  });
});
