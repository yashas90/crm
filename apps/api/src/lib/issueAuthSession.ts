import type { Context } from "hono";
import type { AuthUser } from "../middleware/auth.js";
import { createRefreshSession } from "../services/refreshTokenService.js";
import {
  clearAuthCookie,
  clearRefreshCookie,
  setAuthCookie,
  setRefreshCookie,
} from "./authCookie.js";
import { getClientIp } from "./clientIp.js";
import { getDb } from "./db.js";
import { issueAuthToken } from "./issueAuthToken.js";

export async function issueAuthSession(
  c: Context,
  user: {
    id: string;
    email: string;
    name: string;
    role: AuthUser["role"];
  },
  options?: { issuedAtSec?: number },
): Promise<{ token: string; refreshToken: string }> {
  const db = getDb();
  const { token } = await issueAuthToken(user, options);
  const refreshToken = await createRefreshSession(db, {
    userId: user.id,
    userAgent: c.req.header("user-agent"),
    ipAddress: getClientIp(c),
  });

  setAuthCookie(c, token);
  setRefreshCookie(c, refreshToken);

  return { token, refreshToken };
}

export function clearAuthSession(c: Context) {
  clearAuthCookie(c);
  clearRefreshCookie(c);
}
