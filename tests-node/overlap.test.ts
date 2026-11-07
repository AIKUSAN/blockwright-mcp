// Copyright (c) 2026 AIKUSAN. GPL-3.0-only. Part of Blockwright MCP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxFromCube, findOverlaps, type IBox } from "../lib/overlap.ts";

// Axis-aligned helper; rotation in degrees about Y around `pivot`.
const box = (name: string, from: number[], to: number[], rotY = 0, pivot = [0, 0, 0]): IBox =>
  boxFromCube({ name, from, to, rotation: [0, rotY, 0], origin: pivot });

const body = () => box("body", [-4, 0, -2], [4, 12, 2]);

test("a detail flush with the body's front face z-fights; the detail gets nudged out", () => {
  const r = findOverlaps([body(), box("patch", [-1, 5, 1.5], [1, 7, 2])]);
  assert.equal(r.zFighting.length, 1);
  const z = r.zFighting[0];
  assert.deepEqual([z.a, z.b].sort(), ["body", "patch"]);
  assert.ok(Math.abs(z.area - 4) < 1e-6, `area ${z.area}`);
  assert.equal(z.suggestion.cube, "patch");
  assert.deepEqual(z.suggestion.offset.map(v => +v.toFixed(3)), [0, 0, 0.01]);
});

test("cubes touching back to back (opposite faces) do not z-fight", () => {
  const r = findOverlaps([box("a", [0, 0, 0], [4, 4, 4]), box("b", [4, 0, 0], [8, 4, 4])]);
  assert.equal(r.zFighting.length, 0);
  assert.equal(r.volumeOverlaps.length, 0, "touching is not overlapping");
});

test("separated cubes report nothing", () => {
  const r = findOverlaps([box("a", [0, 0, 0], [1, 1, 1]), box("b", [5, 5, 5], [6, 6, 6])]);
  assert.deepEqual([r.zFighting.length, r.volumeOverlaps.length], [0, 0]);
});

test("two cubes rotated the same way stay coplanar and are still caught", () => {
  const r = findOverlaps([box("a", [-2, 0, -2], [2, 4, 2], 45), box("b", [-1, 1, 1.5], [1, 3, 2], 45)]);
  assert.equal(r.zFighting.length, 1);
});

test("a rotated detail against an unrotated face is not coplanar", () => {
  const r = findOverlaps([body(), box("tilted", [-1, 5, 1.5], [1, 7, 2], 30, [0, 6, 1.75])]);
  assert.equal(r.zFighting.length, 0);
});

test("interpenetrating cubes are reported with a depth; the shallowest axis is named", () => {
  const r = findOverlaps([box("a", [0, 0, 0], [4, 4, 4]), box("b", [3, 1, 1], [7, 3, 3])]);
  assert.equal(r.volumeOverlaps.length, 1);
  assert.ok(Math.abs(r.volumeOverlaps[0].depth - 1) < 1e-6, `depth ${r.volumeOverlaps[0].depth}`);
});

test("inflate counts: a cube inflated onto another's face z-fights", () => {
  const a = box("a", [0, 0, 0], [4, 4, 4]);
  const b = boxFromCube({ name: "b", from: [1, 1, 1], to: [3, 3, 3.5], inflate: 0.5, rotation: [0, 0, 0], origin: [0, 0, 0] });
  const r = findOverlaps([a, b]);
  assert.equal(r.zFighting.length, 1, "b's +Z face reaches z=4 with inflate");
});

test("bad numbers are skipped and counted, never crash", () => {
  const r = findOverlaps([body(), boxFromCube({ name: "bad", from: [Number.NaN, 0, 0], to: [1, 1, 1], rotation: [0, 0, 0], origin: [0, 0, 0] })]);
  assert.equal(r.skipped, 1);
  assert.equal(r.checked, 1);
});

test("faces touching only along an edge are not z-fighting", () => {
  const r = findOverlaps([box("a", [0, 0, 0], [2, 2, 2]), box("b", [2, 0, 0], [4, 2, 2])]);
  assert.equal(r.zFighting.length, 0, "the shared +Y plane touches only along x=2");
});
