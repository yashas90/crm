import { env } from "./env.js";

/** Fails at process startup when AUTH_JWT_SECRET is unset (see env.ts). */
export function getJwtSecret() {
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}
