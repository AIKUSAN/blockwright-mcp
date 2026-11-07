/**
 * Counts the tool catalogue from the docs manifest (the same specs the plugin registers)
 * and groups the tools by availability condition.
 *   bun run tests/repro/count-tools.ts
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import { toolManifest } from "../../build/docs-manifest";

const groups = new Map<string, string[]>();
let total = 0;
for (const { tools } of toolManifest) for (const spec of tools) {
  total++;
  const c = spec.condition as unknown;
  const key = c === undefined ? "always"
    : typeof c === "function" ? `function: ${String(c).replace(/\s+/g, " ").slice(0, 70)}`
    : JSON.stringify(c, (_k, v) => typeof v === "function" ? `fn(${String(v).replace(/\s+/g, " ").slice(0, 50)})` : v);
  groups.set(key, [...(groups.get(key) ?? []), spec.name]);
}
console.log(`total specs: ${total}, distinct names: ${new Set(toolManifest.flatMap((g) => g.tools.map((t) => t.name))).size}`);
for (const [key, names] of [...groups].sort((a, b) => b[1].length - a[1].length)) console.log(`${String(names.length).padStart(4)}  ${key}${names.length <= 6 ? `  [${names.join(", ")}]` : ""}`);
