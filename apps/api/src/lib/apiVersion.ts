import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

function readVersionFromPackageJson(pkgPath: string): string | null {
  try {
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version?.trim() || null;
  } catch {
    return null;
  }
}

/** Package version from apps/api/package.json (works for tsx src/ and dist/). */
export function getApiVersion(): string {
  if (cachedVersion) return cachedVersion;

  const fromEnv =
    process.env.npm_package_version?.trim() ||
    process.env.API_VERSION?.trim() ||
    process.env.RAILWAY_SERVICE_VERSION?.trim() ||
    null;
  if (fromEnv) {
    cachedVersion = fromEnv;
    return cachedVersion;
  }

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "../../package.json"), // src/lib or dist/lib → apps/api/package.json
      join(here, "../../../apps/api/package.json"), // unexpected nesting
      join(process.cwd(), "apps/api/package.json"),
      join(process.cwd(), "package.json"),
    ];
    for (const pkgPath of candidates) {
      const version = readVersionFromPackageJson(pkgPath);
      if (version) {
        cachedVersion = version;
        return cachedVersion;
      }
    }
  } catch {
    // fall through
  }

  cachedVersion = "0.0.0";
  return cachedVersion;
}

/** Bump when shipping API behavior that must be verified on Railway /health. */
export const API_DEPLOY_MARKER = "bulk-import-new-status-2026-08-21";
