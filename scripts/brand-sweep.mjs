import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const REPLACEMENTS = [
  ["#2563EB", "#204060"],
  ["#2563eb", "#204060"],
  ["#1d4ed8", "#1a3550"],
  ["#1D4ED8", "#1a3550"],
  ["#FF6B6B", "#C02020"],
  ["#ff6b6b", "#C02020"],
  ["#ef4444", "#9a1818"],
  ["#EF4444", "#9a1818"],
  ["rgba(20, 184, 166, 0.15)", "#dbeafe"],
  ["rgba(20,184,166,0.15)", "#dbeafe"],
  ["rgba(20, 184, 166, 0.35)", "#204060"],
  ["rgba(20,184,166,0.35)", "#204060"],
  ["rgba(20, 184, 166, 0.08)", "#FEF08A"],
  ["rgba(20,184,166,0.08)", "#FEF08A"],
  ["rgba(20, 184, 166, 0.3)", "#204060"],
  ["rgba(20,184,166,0.3)", "#204060"],
  ["colors.textMutedDark", "colors.textMuted"],
  ["colors.textDark", "colors.text"],
  ["colors.cardDark", "colors.card"],
  ["colors.backgroundDark", "colors.background"],
  ["colors.borderDark", "colors.border"],
  ["colors.primaryLight", "colors.primary"],
  [
    "rounded-xl border border-border bg-background p-3 shadow-lg",
    "border-2 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]",
  ],
  [
    "rounded-xl border border-border bg-background shadow-lg",
    "border-2 border-black bg-white shadow-[4px_4px_0_0_#000]",
  ],
  [
    "rounded-xl border border-border bg-card shadow-lg",
    "border-2 border-black bg-white shadow-[4px_4px_0_0_#000]",
  ],
  ["rounded-xl border border-border", "border-2 border-black"],
  ["shadow-lg", "shadow-[4px_4px_0_0_#000]"],
  ["shadow-sm", "shadow-[2px_2px_0_0_#000]"],
  ["border-border/60", "border-black"],
];

const EXT = new Set([".ts", ".tsx", ".css", ".mjs"]);
const SKIP = new Set(["node_modules", ".next", "dist", ".git", "brand-sweep.mjs"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== original) {
    fs.writeFileSync(file, text);
    changed++;
    console.log("updated:", path.relative(ROOT, file));
  }
}
console.log(`\nDone. ${changed} files updated.`);
