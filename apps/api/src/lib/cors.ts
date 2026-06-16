import { env } from "./env.js";
import { logger } from "./logger.js";

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:8081"] as const;

export const PRODUCTION_WEB_ORIGINS = [
  "https://www.ninjamarketing.in",
  "https://ninjamarketing.in",
] as const;

function parseEnvOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

function hasWildcard(origins: string[]): boolean {
  return origins.some((origin) => origin === "*" || origin.includes("*"));
}

/** Resolve allowed browser origins for CORS. Production rejects wildcards and requires explicit domains. */
export function resolveCorsOrigins(): string[] {
  const fromEnv = parseEnvOrigins();

  if (env.NODE_ENV === "production") {
    if (hasWildcard(fromEnv)) {
      throw new Error("CORS_ORIGINS must not contain wildcards (*) in production");
    }

    if (fromEnv.length === 0) {
      logger.error(
        "CORS_ORIGINS is not set in production; using default ninjamarketing.in origins only",
      );
      return [...PRODUCTION_WEB_ORIGINS];
    }

    return [...new Set(fromEnv)];
  }

  return fromEnv.length > 0 ? [...new Set([...DEV_ORIGINS, ...fromEnv])] : [...DEV_ORIGINS];
}
