const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve: metroResolve } = require("metro-resolver");

// Local Gradle `export:embed` runs without shell env; keep Metro rooted at apps/mobile
// instead of the pnpm workspace root (otherwise it looks for ./index.js at repo root).
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/**
 * Mobile uses React 19; the monorepo root hoists React 18 for Next.js web.
 * Always resolve singleton React packages from the mobile app tree.
 */
function resolveFromMobile(moduleName) {
  return require.resolve(moduleName, { paths: [projectRoot] });
}

function resolveUseSync(moduleName) {
  // Prefer the react@19 peer variant (navigation depends on React 19).
  // Bare resolve from projectRoot often picks the hoisted react@18 variant.
  try {
    const navCore = path.dirname(
      require.resolve("@react-navigation/core/package.json", { paths: [projectRoot] }),
    );
    return require.resolve(moduleName, { paths: [navCore, projectRoot] });
  } catch {
    return resolveFromMobile(moduleName);
  }
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Must include monorepo root so Metro can read hoisted node_modules (@babel/runtime, etc.).
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return { type: "sourceFile", filePath: resolveFromMobile(moduleName) };
  }

  if (
    moduleName === "use-sync-external-store" ||
    moduleName.startsWith("use-sync-external-store/")
  ) {
    return { type: "sourceFile", filePath: resolveUseSync(moduleName) };
  }

  if (moduleName === "scheduler" || moduleName.startsWith("scheduler/")) {
    try {
      return { type: "sourceFile", filePath: resolveFromMobile(moduleName) };
    } catch {
      // optional — fall through
    }
  }

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
