/**
 * Patches apps/mobile/android after `expo prebuild` for pnpm monorepo + local Gradle builds.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildGradle = path.join(root, "android", "app", "build.gradle");

if (!fs.existsSync(buildGradle)) {
  console.error(
    "android/app/build.gradle not found — run: pnpm exec expo prebuild --platform android",
  );
  process.exit(1);
}

let contents = fs.readFileSync(buildGradle, "utf8");

const projectRootBlock = "def projectRoot = projectDir.parentFile.parentFile.absolutePath";

if (!contents.includes(projectRootBlock)) {
  if (contents.includes("def projectRoot = ")) {
    contents = contents.replace(/def projectRoot = .+\n/, `${projectRootBlock}\n`);
  } else {
    contents = contents.replace(
      'apply plugin: "com.facebook.react"\n',
      `apply plugin: "com.facebook.react"\n\n${projectRootBlock}\n`,
    );
  }
}

// Idempotent: ensure monorepo root + entry file + embedded JS for all variants.
if (!contents.includes('entryFile = new File(projectRoot, "index.js")')) {
  contents = contents.replace(
    /react \{\s*\n/,
    `react {
    root = file(projectRoot)
    entryFile = new File(projectRoot, "index.js")
    debuggableVariants = []
`,
  );
} else {
  contents = contents.replace(
    /(\s*\/\/ Embed JS in debug APKs[^\n]*\n\s*debuggableVariants = \[\]\n)+/g,
    "    // Embed JS in all variants so APKs work without Metro.\n    debuggableVariants = []\n",
  );
}

const envHook = `
// --- PropNinja monorepo: Expo bundle env for local Gradle builds ---
def expoApiUrl = findProperty("EXPO_PUBLIC_API_URL") ?: "https://crm-production-e81d.up.railway.app"
tasks.withType(Exec).configureEach { task ->
    if (task.name.contains("createBundle")) {
        task.workingDir = file(projectRoot)
        task.environment("EXPO_NO_METRO_WORKSPACE_ROOT", "1")
        task.environment("NODE_ENV", "production")
        task.environment("EXPO_PUBLIC_API_URL", expoApiUrl)
        task.environment("NODE_OPTIONS", "--max-old-space-size=8192")
    }
}
`;

contents = contents.replace(/\n\/\/ --- PropNinja monorepo:[\s\S]*?(?=\n$)/, "");
if (!contents.includes("PropNinja monorepo")) {
  contents = `${contents.trimEnd()}\n${envHook}\n`;
}

fs.writeFileSync(buildGradle, contents);

// Keep Android versionCode/versionName in sync with app.config.ts.
// Expo prebuild defaults versionCode to 1 — installing over an older APK then fails with
// "App not installed" on many phones because versionCode did not increase.
const appConfigPath = path.join(root, "app.config.ts");
const appConfigSrc = fs.readFileSync(appConfigPath, "utf8");
const versionNameMatch = appConfigSrc.match(/^\s*version:\s*"(\d+\.\d+\.\d+)"/m);
const versionCodeMatch = appConfigSrc.match(/^\s*versionCode:\s*(\d+)/m);
if (versionNameMatch && versionCodeMatch) {
  const versionName = versionNameMatch[1];
  const versionCode = versionCodeMatch[1];
  let gradle = fs.readFileSync(buildGradle, "utf8");
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  // v1+v2 signing: some OEM installers reject v2-only APKs.
  if (!gradle.includes("enableV1Signing")) {
    gradle = gradle.replace(
      /signingConfigs \{\s*\n\s*debug \{/,
      `signingConfigs {
        debug {
            enableV1Signing true
            enableV2Signing true`,
    );
  }
  fs.writeFileSync(buildGradle, gradle);
  console.log(`Synced Android versionName=${versionName} versionCode=${versionCode}`);
}

const gradleProps = path.join(root, "android", "gradle.properties");
let props = fs.readFileSync(gradleProps, "utf8");

const required = {
  EXPO_PUBLIC_API_URL: "https://crm-production-e81d.up.railway.app",
  EXPO_NO_METRO_WORKSPACE_ROOT: "1",
};

for (const [key, value] of Object.entries(required)) {
  const line = `${key}=${value}`;
  if (!props.includes(`${key}=`)) {
    props = `${props.trimEnd()}\n${line}\n`;
  }
}

if (!props.includes("org.gradle.parallel=false")) {
  props = props.replace(/# org.gradle.parallel=true/, "org.gradle.parallel=false");
}

if (!props.includes("org.gradle.jvmargs=-Xmx4096m")) {
  props = props.replace(
    /org.gradle.jvmargs=.+/,
    "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError",
  );
}

fs.writeFileSync(gradleProps, props);
console.log("Patched android project for monorepo local builds.");
