// Copyright (c) 2026 AIKUSAN. GPL-3.0-only. Part of Blockwright MCP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sideFromName, checkSides, type ISideCandidate } from "../lib/side-guard.ts";

test("name parsing: separators, camelCase, short forms, and no false hits inside words", () => {
  assert.equal(sideFromName("arm_left"), "left");
  assert.equal(sideFromName("leftArm"), "left");
  assert.equal(sideFromName("ArmRight"), "right");
  assert.equal(sideFromName("leg_r"), "right");
  assert.equal(sideFromName("L_ear"), "left");
  assert.equal(sideFromName("wing.R.2"), "right");
  assert.equal(sideFromName("leftover_cube"), null, "'leftover' is not 'left'");
  assert.equal(sideFromName("bright_light"), null, "'bright' is not 'right'");
  assert.equal(sideFromName("body"), null);
  assert.equal(sideFromName("left_to_right_bar"), null, "both sides named: no claim");
  assert.equal(sideFromName(""), null);
});

const cube = (name: string, from: number[], to: number[]): ISideCandidate => ({ name, kind: "cube", from, to });

test("model faces -Z: +X is its right; a matching name passes", () => {
  const r = checkSides([cube("arm_right", [4, 0, -1], [6, 10, 1]), cube("arm_left", [-6, 0, -1], [-4, 10, 1])]);
  assert.equal(r.mismatches.length, 0);
  assert.equal(r.checked, 2);
});

test("a left-named cube on +X is a mismatch with a clear message", () => {
  const r = checkSides([cube("leg_left", [1, -6, -1], [3, 0, 1])]);
  assert.equal(r.mismatches.length, 1);
  assert.deepEqual([r.mismatches[0].claimed, r.mismatches[0].actual], ["left", "right"]);
  assert.match(r.mismatches[0].message, /"leg_left" is named left but sits on the model's right \(\+x\)/);
});

test("a side-named part in the centre is reported as centred, not as the other side", () => {
  const r = checkSides([cube("ear_left", [-0.2, 10, 0], [0.2, 12, 1])]);
  assert.equal(r.mismatches[0].actual, "center");
});

test("groups use their pivot origin", () => {
  const r = checkSides([{ name: "arm_left", kind: "group", origin: [5, 12, 0] }]);
  assert.equal(r.mismatches[0].actual, "right");
});

test("format facing +Z flips the sides", () => {
  const r = checkSides([cube("arm_right", [4, 0, -1], [6, 10, 1])], "+z");
  assert.equal(r.mismatches.length, 1);
});

test("unnamed sides and bad numbers are skipped, never crash", () => {
  const r = checkSides([cube("body", [-4, 0, -2], [4, 12, 2]), cube("arm_left", [Number.NaN, 0, 0], [1, 1, 1]), { name: "tail_left", kind: "group" }]);
  assert.equal(r.checked, 0);
  assert.equal(r.mismatches.length, 0);
});
