#!/usr/bin/env node
/**
 * Guard Railway builds (Nixpacks or Docker) against stale snapshots that still
 * ship apps/api@0.0.0 without a deploy marker.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "apps/api/package.json");
const apiVersionPath = join(root, "apps/api/src/lib/apiVersion.ts");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
if (!version || version === "0.0.0") {
  console.error(
    `[assert-api-deploy-identity] Refusing Railway build: apps/api version is "${version || "(missing)"}".`,
  );
  console.error(
    "This usually means Railway is building a stale Nixpacks snapshot, not current GitHub main.",
  );
  console.error(
    "Fix: Settings → Build → Builder = Dockerfile (not Nixpacks), Root Directory empty, NO_CACHE=1, deploy latest main.",
  );
  process.exit(1);
}

const apiVersionSrc = readFileSync(apiVersionPath, "utf8");
const markerMatch = apiVersionSrc.match(/API_DEPLOY_MARKER\s*=\s*"([^"]+)"/);
if (!markerMatch) {
  console.error("[assert-api-deploy-identity] API_DEPLOY_MARKER missing from apiVersion.ts");
  process.exit(1);
}

console.log(`[assert-api-deploy-identity] ok version=${version} deployMarker=${markerMatch[1]}`);
