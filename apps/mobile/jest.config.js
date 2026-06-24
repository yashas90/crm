const preset = require("jest-expo/jest-preset");

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  setupFiles: ["<rootDir>/src/test/jest.preload.js", ...preset.setupFiles],
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@react-native/js-polyfills/error-guard$": "<rootDir>/src/test/mocks/error-guard.js",
    // Resolve TypeScript ESM .js imports to .ts sources (workspace packages use .js extensions)
    "^(\\.{1,2}/.+)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  transformIgnorePatterns: ["/node_modules/react-native-reanimated/plugin/"],
};
