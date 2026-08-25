#!/usr/bin/env node
/**
 * Smoke-check a PropNinja APK before distributing to agents.
 * Usage: node scripts/verify-apk.mjs path/to/PropNinja.apk
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const apk = process.argv[2];
if (!apk || !fs.existsSync(apk)) {
  console.error("Usage: node scripts/verify-apk.mjs <file.apk>");
  process.exit(1);
}

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
const aapt = androidHome ? path.join(androidHome, "build-tools", "35.0.0", "aapt") : "aapt";

function must(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

const buf = fs.readFileSync(apk);
must(buf[0] === 0x50 && buf[1] === 0x4b, "file is a ZIP/APK (PK header)");
must(buf.length > 10_000_000, `APK size looks complete (${buf.length} bytes)`);

let badging = "";
try {
  badging = execFileSync(aapt, ["dump", "badging", apk], { encoding: "utf8" });
} catch {
  console.warn("WARN: aapt not available — skipped package metadata checks");
}

if (badging) {
  must(badging.includes("name='com.propninja.crm'"), "package is com.propninja.crm");
  must(/versionName='1\.\d+\.\d+'/.test(badging), "has semver versionName");
  const versionCodeMatch = badging.match(/versionCode='(\d+)'/);
  const versionCode = versionCodeMatch ? Number(versionCodeMatch[1]) : 0;
  must(
    versionCode > 1,
    `versionCode ${versionCode} must be > 1 (else installs fail over older APKs)`,
  );
  must(badging.includes("ACCESS_BACKGROUND_LOCATION"), "declares background location");
  must(badging.includes("FOREGROUND_SERVICE_LOCATION"), "declares FGS location");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "propninja-apk-"));
try {
  execFileSync(
    "unzip",
    ["-q", "-o", apk, "assets/index.android.bundle", "assets/app.config", "-d", tmp],
    {
      stdio: "ignore",
    },
  );
} catch {
  // app.config may be missing on some builds; bundle is required
}

const bundlePath = path.join(tmp, "assets", "index.android.bundle");
must(fs.existsSync(bundlePath), "embeds index.android.bundle (works without Metro)");
const bundle = fs.readFileSync(bundlePath);
must(
  bundle.includes(Buffer.from("crm-production-e81d.up.railway.app")),
  "bundle targets production API",
);
must(!bundle.includes(Buffer.from("10.0.2.2")), "bundle does not use emulator localhost");

const configPath = path.join(tmp, "assets", "app.config");
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  must(
    config.extra?.apiUrl?.includes("crm-production-e81d"),
    "app.config extra.apiUrl is production",
  );
  must(
    typeof config.version === "string" && /^\d+\.\d+\.\d+$/.test(config.version),
    `version ${config.version}`,
  );
}

console.log("\nAPK looks installable and wired to production.");
