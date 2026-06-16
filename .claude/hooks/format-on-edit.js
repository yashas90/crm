const { execSync } = require("node:child_process");
let d = "";
process.stdin.on("data", (c) => {
  d += c;
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(d);
    const f = data.tool_input?.file_path;
    if (!f) process.exit(0);
    if (!/\.(ts|tsx|js|jsx|json|css)$/.test(f)) process.exit(0);
    execSync(`pnpm exec biome check --write "${f}"`, { stdio: "inherit", cwd: process.cwd() });
  } catch {
    process.exit(0);
  }
});
