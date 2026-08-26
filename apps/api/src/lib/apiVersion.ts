import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Bump when shipping API behavior that must be verified on Railway /health. */
export const API_DEPLOY_MARKER = "dialing-pad-feature-2026-08-26c";

type DeployIdentity = {
  version: string;
  deployMarker: string;
  builtAt?: string;
};

let cachedVersion: string | null = null;
let cachedIdentity: DeployIdentity | null | undefined;

function readJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function readVersionFromPackageJson(pkgPath: string): string | null {
  const pkg = readJsonFile<{ version?: string }>(pkgPath);
  const version = pkg?.version?.trim() || null;
  // Treat placeholder 0.0.0 as missing so a bad env cannot hide a real package version.
  if (!version || version === "0.0.0") return null;
  return version;
}

/** Image-baked identity written by the Dockerfile (authoritative on Railway). */
export function getDeployIdentity(): DeployIdentity | null {
  if (cachedIdentity !== undefined) return cachedIdentity;

  const candidates = [join(process.cwd(), "deploy-identity.json"), "/app/deploy-identity.json"];
  for (const path of candidates) {
    const identity = readJsonFile<DeployIdentity>(path);
    if (identity?.version && identity?.deployMarker) {
      cachedIdentity = identity;
      return cachedIdentity;
    }
  }
  cachedIdentity = null;
  return null;
}

/** Package version — prefers Docker bake file, then apps/api/package.json. */
export function getApiVersion(): string {
  if (cachedVersion) return cachedVersion;

  const baked = getDeployIdentity();
  if (baked?.version) {
    cachedVersion = baked.version;
    return cachedVersion;
  }

  // Explicit override only (do not trust npm_package_version / Railway UI version).
  const fromEnv = process.env.API_VERSION?.trim();
  if (fromEnv && fromEnv !== "0.0.0") {
    cachedVersion = fromEnv;
    return cachedVersion;
  }

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "../../package.json"), // src/lib or dist/lib → apps/api/package.json
      join(here, "../../../apps/api/package.json"),
      join(process.cwd(), "apps/api/package.json"),
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

export function getDeployMarker(): string {
  return getDeployIdentity()?.deployMarker || API_DEPLOY_MARKER;
}
