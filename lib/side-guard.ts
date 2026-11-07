/**
 * Side guard: compares a part's left/right name with where its geometry is.
 * Pure logic, runs under `node --test`. Uses lib/orientation.ts, whose
 * orientation maths is adapted from sosadly/blockbench-mcp (MIT).
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import { orientation, sideOfCoord, type Vec3 } from "./orientation.ts";

const RIGHT_WORDS = new Set(["right", "rght", "rgt", "rt", "r"]);
const LEFT_WORDS = new Set(["left", "lft", "lt", "l"]);

/** Splits "leftArm_02", "arm.R" or "L-ear" into lower-case word tokens. */
function tokens(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .map(t => t.toLowerCase())
    .filter(Boolean);
}

/** The side a name claims, from whole-word tokens only; null when it claims none or both. */
export function sideFromName(name: string): "left" | "right" | null {
  const words = tokens(name);
  const right = words.some(w => RIGHT_WORDS.has(w));
  const left = words.some(w => LEFT_WORDS.has(w));
  if (right === left) return null;
  return right ? "right" : "left";
}

export interface ISideCandidate {
  name: string;
  kind: "cube" | "group";
  from?: number[];
  to?: number[];
  origin?: number[];
}

export interface ISideMismatch {
  name: string;
  claimed: "left" | "right";
  actual: "left" | "right" | "center";
  message: string;
}

export interface ISideReport {
  checked: number;
  rightAxis: string;
  mismatches: ISideMismatch[];
}

function point(c: ISideCandidate): Vec3 | null {
  const p = c.kind === "cube" && c.from && c.to
    ? [0, 1, 2].map(i => ((c.from![i] ?? NaN) + (c.to![i] ?? NaN)) / 2)
    : c.origin ? [0, 1, 2].map(i => c.origin![i] ?? NaN) : null;
  return p && p.every(Number.isFinite) ? (p as Vec3) : null;
}

/**
 * Checks every candidate whose name claims a side. Cube positions are their
 * from/to centre (Blockbench stores absolute coordinates), group positions
 * their pivot; parent rotations are not applied.
 */
export function checkSides(candidates: ISideCandidate[], forwardDirection?: string | null): ISideReport {
  const o = orientation(forwardDirection);
  const mismatches: ISideMismatch[] = [];
  let checked = 0;
  for (const c of candidates) {
    const claimed = sideFromName(c.name);
    const p = point(c);
    if (!claimed || !p) continue;
    checked += 1;
    const actual = sideOfCoord(p, o);
    if (actual === claimed) continue;
    const where = actual === "center"
      ? "sits in the centre, on neither side"
      : `sits on the model's ${actual} (${actual === "right" ? o.rightAxis : o.leftAxis})`;
    mismatches.push({
      name: c.name,
      claimed,
      actual,
      message: `"${c.name}" is named ${claimed} but ${where}. The model faces ${o.facing}, so its right is ${o.rightAxis}. Rename it or move it.`,
    });
  }
  return { checked, rightAxis: o.rightAxis, mismatches };
}
