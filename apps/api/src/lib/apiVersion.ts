import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

/** Package version from apps/api/package.json */
export function getApiVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    cachedVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }

  return cachedVersion;
}
