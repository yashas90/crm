/** Decode JWT payload without verification (client-side role hint only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded =
      typeof globalThis.atob === "function"
        ? globalThis.atob(base64 + padding)
        : Buffer.from(base64 + padding, "base64").toString("utf8");

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function roleFromJwt(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return typeof role === "string" ? role : null;
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return Date.now() / 1000 >= exp - bufferSeconds;
}
