const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve: metroResolve } = require("metro-resolver");

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
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
  return metroResolve(context, moduleName, platform);
};

module.exports = config;
