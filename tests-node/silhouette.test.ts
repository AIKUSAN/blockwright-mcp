// Copyright (c) 2026 AIKUSAN. GPL-3.0-only. Part of Blockwright MCP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskFromRGBA, cropAndFit, compareMasks, diffImage } from "../lib/silhouette.ts";

/** w×h RGBA image, background rgb `bg` (opaque), filled rect [x0,y0,x1,y1) in `fg`. */
function img(w: number, h: number, rects: number[][], bg = [30, 31, 34, 255], fg = [200, 120, 60, 255]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(bg, i * 4);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d.set(fg, (y * w + x) * 4);
  return d;
}

test("mask: opaque image uses the corner background colour", () => {
  const m = maskFromRGBA(img(10, 10, [[2, 2, 5, 8]]), 10, 10);
  assert.equal(m.mode, "background");
  assert.equal(m.mask.reduce((s, v) => s + v, 0), 3 * 6);
});

test("mask: transparent image uses alpha", () => {
  const m = maskFromRGBA(img(10, 10, [[0, 0, 4, 4]], [0, 0, 0, 0], [10, 10, 10, 255]), 10, 10);
  assert.equal(m.mode, "alpha");
  assert.equal(m.mask.reduce((s, v) => s + v, 0), 16);
});

test("crop and fit: same shape at different sizes and positions gives the same mask", () => {
  const a = cropAndFit(maskFromRGBA(img(40, 40, [[5, 5, 15, 35]]), 40, 40).mask, 40, 40, 32);
  const b = cropAndFit(maskFromRGBA(img(100, 100, [[50, 10, 75, 85]]), 100, 100).mask, 100, 100, 32);
  const r = compareMasks(a, b, 32);
  assert.ok(r.iou > 0.95, `iou ${r.iou}`);
});

test("compare: identical masks score 1, the worst region is named, misses counted", () => {
  // 30×30 shapes inside 40×40 images (a 5 px background margin, so the corners are background)
  const ref = cropAndFit(maskFromRGBA(img(40, 40, [[5, 5, 35, 35]]), 40, 40).mask, 40, 40, 30);
  const same = compareMasks(ref, ref, 30);
  assert.equal(same.iou, 1);
  // model: same square with the top-right third missing
  const model = cropAndFit(maskFromRGBA(img(40, 40, [[5, 5, 25, 35], [25, 15, 35, 35]]), 40, 40).mask, 40, 40, 30);
  const r = compareMasks(model, ref, 30);
  assert.ok(r.iou < 1 && r.iou > 0.8, `iou ${r.iou}`);
  assert.equal(r.onlyReference > 0, true);
  assert.equal(r.onlyModel, 0);
  assert.equal(r.worst[0].region, "top-right");
});

test("compare: empty masks never divide by zero", () => {
  const empty = new Uint8Array(16);
  const r = compareMasks(empty, empty, 4);
  assert.equal(r.iou, 1, "two empty silhouettes agree");
  const one = new Uint8Array(16); one[0] = 1;
  assert.equal(compareMasks(one, empty, 4).iou, 0);
});

test("crop and fit: an empty mask stays empty", () => {
  const out = cropAndFit(new Uint8Array(100), 10, 10, 8);
  assert.equal(out.reduce((s, v) => s + v, 0), 0);
});

test("diff image: grey where both, red model-only, blue reference-only", () => {
  const model = Uint8Array.from([1, 1, 0, 0]);
  const ref = Uint8Array.from([1, 0, 1, 0]);
  const d = diffImage(model, ref, 2);
  const px = (i: number) => Array.from(d.slice(i * 4, i * 4 + 4));
  assert.deepEqual(px(0).slice(0, 3), [170, 170, 170]);
  assert.deepEqual(px(1).slice(0, 3), [230, 60, 60]);
  assert.deepEqual(px(2).slice(0, 3), [60, 110, 230]);
  assert.equal(px(3)[3], 0, "neither: transparent");
});
