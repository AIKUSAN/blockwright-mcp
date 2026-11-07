// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planReviewSheet, composeReviewSheet, relabelCell, DEFAULT_REVIEW_VIEWS, isUsableBounds,
  type ISheetContext,
} from "../lib/review-sheet.ts";
import type { ReviewViewName } from "../lib/orientation.ts";

const bounds = { min: [-4, 0, -6] as [number, number, number], max: [4, 20, 6] as [number, number, number] };

function fakeCanvas() {
  const calls: { op: string; args: unknown[] }[] = [];
  const ctx: ISheetContext = {
    fillStyle: "", font: "", textAlign: "", textBaseline: "",
    fillRect: (...args) => { calls.push({ op: "fillRect", args }); },
    fillText: (...args) => { calls.push({ op: "fillText", args }); },
    drawImage: (...args) => { calls.push({ op: "drawImage", args }); },
  };
  return { calls, canvas: { getContext: () => ctx, toDataURL: () => "data:image/png;base64,SHEET" } };
}

test("default sheet: 6 views in a 3x2 grid, one camera each, all aimed at the bounds centre", () => {
  const plan = planReviewSheet({ views: DEFAULT_REVIEW_VIEWS, bounds });
  assert.equal(plan.cells.length, 6);
  assert.equal(plan.columns, 3);
  assert.equal(plan.rows, 2);
  assert.equal(plan.width, 3 * plan.cellSize);
  for (const cell of plan.cells) assert.deepEqual(cell.camera.target, [0, 10, 0]);
  const front = plan.cells.find(c => c.view === "front")!;
  assert.ok(front.camera.position[2] < -10, "front camera stands on the -Z side");
  assert.equal(front.label.modelRightOn, "image_left");
});

test("cells never overlap and stay inside the sheet", () => {
  const plan = planReviewSheet({ views: DEFAULT_REVIEW_VIEWS, bounds });
  for (const c of plan.cells) {
    assert.ok(c.x + plan.cellSize <= plan.width);
    assert.ok(c.y - plan.barHeight >= 0 && c.y + plan.cellSize + plan.barHeight <= plan.height);
  }
  const keys = new Set(plan.cells.map(c => `${c.column},${c.row}`));
  assert.equal(keys.size, plan.cells.length);
});

test("sheet size is capped: cells shrink to fit maxSheetSize", () => {
  const plan = planReviewSheet({ views: DEFAULT_REVIEW_VIEWS, bounds, cellSize: 1024, maxSheetSize: 1200 });
  assert.ok(plan.width <= 1200 && plan.height <= 1200, `${plan.width}x${plan.height}`);
});

test("bad inputs: no views throws; NaN or inverted bounds fall back to a 16-unit block", () => {
  assert.throws(() => planReviewSheet({ views: [], bounds }), /at least one view/);
  assert.equal(isUsableBounds({ min: [NaN, 0, 0], max: [1, 1, 1] }), false);
  assert.equal(isUsableBounds({ min: [2, 0, 0], max: [1, 1, 1] }), false);
  const plan = planReviewSheet({ views: ["front"], bounds: { min: [Infinity, 0, 0], max: [-Infinity, 0, 0] } });
  assert.deepEqual(plan.cells[0].camera.target, [0, 8, 0]);
});

test("relabelCell uses the real camera's right vector over the planned one", () => {
  const plan = planReviewSheet({ views: ["top"], bounds });
  const relabelled = relabelCell(plan.cells[0], [1, 0, 0]);
  assert.equal(relabelled.label.modelRightOn, "image_right");
});

test("compose draws every render once, with caption and edge labels, and returns the PNG", async () => {
  const plan = planReviewSheet({ views: ["front", "back"], bounds });
  const renders = new Map<ReviewViewName, string>([["front", "data:a"], ["back", "data:b"]]);
  const { calls, canvas } = fakeCanvas();
  const loaded: string[] = [];
  const out = await composeReviewSheet(plan, renders, {
    createCanvas: (w, h) => { assert.equal(w, plan.width); assert.equal(h, plan.height); return canvas; },
    loadImage: async url => { loaded.push(url); return { url }; },
  });
  assert.equal(out, "data:image/png;base64,SHEET");
  assert.deepEqual(loaded, ["data:a", "data:b"]);
  assert.equal(calls.filter(c => c.op === "drawImage").length, 2);
  const texts = calls.filter(c => c.op === "fillText").map(c => c.args[0] as string);
  assert.ok(texts.some(t => t.startsWith("FRONT")));
  assert.ok(texts.includes("◀ model's RIGHT"), texts.join(" | "));
  assert.ok(texts.includes("model's RIGHT ▶"), "back view puts the model's right on the image's right");
});

test("compose refuses a missing render instead of drawing an empty cell", async () => {
  const plan = planReviewSheet({ views: ["front", "back"], bounds });
  const { canvas } = fakeCanvas();
  await assert.rejects(
    composeReviewSheet(plan, new Map([["front", "data:a"]]), { createCanvas: () => canvas, loadImage: async () => ({}) }),
    /Missing render for view "back"/,
  );
});
