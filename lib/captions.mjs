import fs from "node:fs";
import { applyFixes, parseFixRules, wordsToCaptions } from "./captions-core.mjs";
import { FIX_FILE } from "./paths.mjs";

export * from "./captions-core.mjs";

export function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function loadFixRules(file = FIX_FILE) {
  return fs.existsSync(file) ? parseFixRules(fs.readFileSync(file, "utf-8")) : [];
}

export function captionsFromRaw(rawJsonPath) {
  const raw = JSON.parse(fs.readFileSync(rawJsonPath, "utf-8"));
  return applyFixes(wordsToCaptions(raw.words || []), loadFixRules());
}
