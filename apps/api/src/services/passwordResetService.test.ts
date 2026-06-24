import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const state = {
    tokens: [] as Array<{
      id: string;
      userId: string;
      token: string;
      expiresAt: Date;
      usedAt: Date | null;
    }>,
    users: [
      {
        id: "user-1",
        email: "agent@demo.test",
        isActive: true,
        passwordHash: "hash",
      },
    ],
    passwordHashUpdates: [] as string[],
  };

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const token = state.tokens.find((row) => !row.usedAt);
            return token
              ? [{ id: token.id, usedAt: token.usedAt, expiresAt: token.expiresAt }]
              : [];
          },
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (values: { passwordHash?: string; usedAt?: Date }) => ({
        where: () => {
          if ("passwordHash" in values && values.passwordHash) {
            state.passwordHashUpdates.push(values.passwordHash);
          }
          if ("usedAt" in values && values.usedAt) {
            for (const row of state.tokens) {
              if (!row.usedAt) row.usedAt = values.usedAt!;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  const db = {
    select: (shape?: unknown) => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: async (n: number) => {
            if (shape && typeof shape === "object" && shape !== null && "id" in shape) {
              const email = state.users[0]?.email;
              const token = state.tokens[0];
              if (!token) return [];
              return [
                {
                  id: token.id,
                  email,
                  isActive: true,
                  passwordHash: "hash",
                },
              ];
            }

            if (shape && typeof shape === "object" && shape !== null && "tokenId" in shape) {
              const token = state.tokens.find((row) => row.token === "valid-token");
              if (!token) return [];
              return [
                {
                  tokenId: token.id,
                  userId: token.userId,
                  expiresAt: token.expiresAt,
                  usedAt: token.usedAt,
                  email: state.users[0]?.email,
                  isActive: true,
                },
              ];
            }

            return state.users.slice(0, n);
          },
        }),
        innerJoin: () => ({
          where: () => ({
            limit: async () => {
              const token = state.tokens.find((row) => row.token === "valid-token");
              if (!token) return [];
              return [
                {
                  tokenId: token.id,
                  userId: token.userId,
                  expiresAt: token.expiresAt,
                  usedAt: token.usedAt,
                  email: state.users[0]?.email,
                  isActive: true,
                },
              ];
            },
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values: { usedAt?: Date }) => ({
        where: () => {
          if (values.usedAt) {
            for (const row of state.tokens) {
              if (!row.usedAt) row.usedAt = values.usedAt;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (row: { userId: string; token: string; expiresAt: Date }) => ({
        returning: async () => {
          const created = {
            id: `token-${state.tokens.length + 1}`,
            userId: row.userId,
            token: row.token,
            expiresAt: row.expiresAt,
            usedAt: null,
          };
          state.tokens.push(created);
          return [created];
        },
      }),
    }),
    transaction: async (fn: (trx: typeof tx) => Promise<void>) => fn(tx),
    __state: state,
  };

  return { db, state };
});

vi.mock("../lib/db.js", () => ({
  getDb: () => dbMocks.db,
}));

vi.mock("../lib/resendEmail.js", () => ({
  buildPasswordResetUrl: (token: string) => `https://example.test/reset-password?token=${token}`,
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../lib/password.js", () => ({
  hashPassword: vi.fn(async (plain: string) => `hashed:${plain}`),
}));

vi.mock("./tokenRevocationService.js", () => ({
  revokeAllUserSessions: vi.fn(),
}));

vi.mock("./passwordHistoryService.js", () => ({
  setUserPassword: vi.fn(async (_db: unknown, _userId: string, plain: string) => {
    dbMocks.state.passwordHashUpdates.push(`hashed:${plain}`);
    return { valid: true as const };
  }),
}));

describe("passwordResetService", () => {
  beforeEach(() => {
    dbMocks.state.tokens = [];
    dbMocks.state.passwordHashUpdates = [];
    vi.clearAllMocks();
  });

  it("creates a token that expires in one hour", async () => {
    const now = new Date("2026-06-16T10:00:00.000Z");
    const { createPasswordResetToken, passwordResetExpiresAt } = await import(
      "./passwordResetService.js"
    );

    const row = await createPasswordResetToken("user-1", now);
    expect(row.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(row.expiresAt.getTime()).toBe(passwordResetExpiresAt(now).getTime());
    expect(dbMocks.state.tokens).toHaveLength(1);
  });

  it("rejects expired tokens", async () => {
    const now = new Date("2026-06-16T12:00:00.000Z");
    dbMocks.state.tokens.push({
      id: "token-1",
      userId: "user-1",
      token: "valid-token",
      expiresAt: new Date("2026-06-16T11:00:00.000Z"),
      usedAt: null,
    });

    const { validatePasswordResetToken } = await import("./passwordResetService.js");
    const result = await validatePasswordResetToken("valid-token", now);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects used tokens", async () => {
    const now = new Date("2026-06-16T10:30:00.000Z");
    dbMocks.state.tokens.push({
      id: "token-1",
      userId: "user-1",
      token: "valid-token",
      expiresAt: new Date("2026-06-16T11:00:00.000Z"),
      usedAt: new Date("2026-06-16T10:15:00.000Z"),
    });

    const { validatePasswordResetToken } = await import("./passwordResetService.js");
    const result = await validatePasswordResetToken("valid-token", now);
    expect(result).toEqual({ valid: false, reason: "used" });
  });

  it("enforces single-use when completing a reset", async () => {
    const now = new Date("2026-06-16T10:30:00.000Z");
    dbMocks.state.tokens.push({
      id: "token-1",
      userId: "user-1",
      token: "valid-token",
      expiresAt: new Date("2026-06-16T11:00:00.000Z"),
      usedAt: null,
    });

    const { completePasswordReset, validatePasswordResetToken } = await import(
      "./passwordResetService.js"
    );

    const first = await completePasswordReset("valid-token", "new-password-1", now);
    expect(first).toEqual({ valid: true });
    expect(dbMocks.state.passwordHashUpdates).toEqual(["hashed:new-password-1"]);

    const second = await validatePasswordResetToken("valid-token", now);
    expect(second).toEqual({ valid: false, reason: "used" });
  });
});
