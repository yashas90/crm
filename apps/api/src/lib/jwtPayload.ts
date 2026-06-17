import { createHash } from "node:crypto";

/** Decode JWT payload without verification to read claims for early auth checks. */
export function decodeJwtPayload(token: string): {
  sub: string | null;
  jti: string | null;
  iat: number | null;
} {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { sub: null, jti: null, iat: null };
    }
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as {
      sub?: unknown;
      jti?: unknown;
      iat?: unknown;
    };
    return {
      sub: typeof payload.sub === "string" ? payload.sub : null,
      jti: typeof payload.jti === "string" ? payload.jti : null,
      iat: typeof payload.iat === "number" ? payload.iat : null,
    };
  } catch {
    return { sub: null, jti: null, iat: null };
  }
}

/** @deprecated Use decodeJwtPayload */
export function decodeJwtSubject(token: string): string | null {
  return decodeJwtPayload(token).sub;
}

export function hashEmailForAudit(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}
