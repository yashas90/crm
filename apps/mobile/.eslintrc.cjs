/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  env: {
    es2022: true,
  },
  ignorePatterns: ["node_modules/", ".expo/", "dist/"],
  overrides: [
    {
      files: ["src/**/*.{ts,tsx}"],
      rules: {
        "no-console": [
          "warn",
          {
            allow: ["warn", "error"],
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "CallExpression[callee.object.name='console'][callee.property.name='log'] Literal[value=/phone|email|contact|password|token/i]",
            message:
              "Do not log PII in console.log. Log IDs only (e.g. lead.id) or remove the statement.",
          },
          {
            selector:
              "CallExpression[callee.object.name='console'][callee.property.name='log'] Identifier[name=/^(lead|contact|user)$/i]",
            message:
              "Do not log full lead/contact/user objects. Log specific non-PII fields or IDs only.",
          },
        ],
      },
    },
  ],
};
