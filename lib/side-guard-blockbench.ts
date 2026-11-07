/// <reference types="blockbench-types" />
/**
 * Side guard for the creation tools: reads the format's facing and applies
 * lib/side-guard.ts.
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import { checkSides, type ISideCandidate } from "@/lib/side-guard";

/** Returns warning lines for mismatched names; throws instead when mode is "refuse". */
export function guardSides(candidates: ISideCandidate[], mode: "warn" | "refuse" | "off" = "warn"): string[] {
  if (mode === "off") return [];
  const facing: unknown = typeof Format !== "undefined" && Format ? Reflect.get(Format, "forward_direction") : undefined;
  const report = checkSides(candidates, typeof facing === "string" ? facing : null);
  if (!report.mismatches.length) return [];
  const lines = report.mismatches.map(m => `Side check: ${m.message}`);
  if (mode === "refuse") throw new Error(`Nothing was created. ${lines.join(" ")} Pass side_check "warn" or "off" to create it anyway.`);
  return lines;
}
