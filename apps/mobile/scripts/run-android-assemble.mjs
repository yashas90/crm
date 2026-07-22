/**
 * Runs Gradle assemble with env required for Expo Metro in a pnpm monorepo.
 * BundleHermesCTask is not an Exec task, so build.gradle Exec hooks cannot set this.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const variant = process.argv[2] === "release" ? "assembleRelease" : "assembleDebug";
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = path.join(mobileRoot, "android");
const isWin = process.platform === "win32";
const gradlew = path.join(androidRoot, isWin ? "gradlew.bat" : "gradlew");

const env = {
  ...process.env,
  EXPO_NO_METRO_WORKSPACE_ROOT: "1",
  NODE_ENV: "production",
  EXPO_PUBLIC_API_URL:
    process.env.EXPO_PUBLIC_API_URL ?? "https://crm-production-e81d.up.railway.app",
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=8192",
};

const result = spawnSync(gradlew, [variant], {
  cwd: androidRoot,
  env,
  stdio: "inherit",
  shell: isWin,
});

process.exit(result.status ?? 1);
