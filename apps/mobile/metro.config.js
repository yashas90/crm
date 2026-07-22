const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve: metroResolve } = require("metro-resolver");

// Local Gradle `export:embed` runs without shell env; keep Metro rooted at apps/mobile
// instead of the pnpm workspace root (otherwise it looks for ./index.js at repo root).
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Monorepo TS packages use `.js` import specifiers; Metro should resolve them to `.ts` sources.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    const target = path.join(projectRoot, "src", moduleName.slice(2));
    return metroResolve(context, target, platform);
  }
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    !moduleName.endsWith(".native.js")
  ) {
    const tsCandidate = moduleName.replace(/\.js$/, ".ts");
    try {
      return metroResolve(context, tsCandidate, platform);
    } catch {
      // fall through
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return metroResolve(context, moduleName, platform);
};

module.exports = config;
