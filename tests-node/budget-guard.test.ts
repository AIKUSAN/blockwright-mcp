// Copyright (c) 2026 AIKUSAN. GPL-3.0-only. Part of Blockwright MCP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGlHealthMonitor, budgetDecision, isExpectedLoss, renderWithAutoRecover, RendererUnavailableError } from "../lib/gl-health.ts";

type Listener = (event: { preventDefault(): void }) => void;
function fakeCanvas() {
  const map = new Map<string, Set<Listener>>();
  return {
    addEventListener(t: string, fn: Listener) { (map.get(t) ?? map.set(t, new Set()).get(t)!).add(fn); },
    removeEventListener(t: string, fn: Listener) { map.get(t)?.delete(fn); },
    fire(t: string) { for (const fn of map.get(t) ?? []) fn({ preventDefault() {} }); },
  };
}

test("monitor notifies loss listeners with the view id, once per loss, and unsubscribes", () => {
  const m = createGlHealthMonitor();
  const c = fakeCanvas();
  m.watch("main", c);
  const seen: string[] = [];
  const off = m.onLost(id => seen.push(id));
  c.fire("webglcontextlost");
  c.fire("webglcontextrestored");
  c.fire("webglcontextlost");
  assert.deepEqual(seen, ["main", "main"]);
  off();
  c.fire("webglcontextlost");
  assert.equal(seen.length, 2);
});

test("a throwing loss listener does not stop the others or the bookkeeping", () => {
  const m = createGlHealthMonitor();
  const c = fakeCanvas();
  m.watch("v", c);
  const seen: string[] = [];
  m.onLost(() => { throw new Error("toast failed"); });
  m.onLost(id => seen.push(id));
  c.fire("webglcontextlost");
  assert.deepEqual(seen, ["v"]);
  assert.deepEqual(m.lostIds(), ["v"]);
});

test("budget: allows below the budget, refuses at it, explains why", () => {
  assert.deepEqual(budgetDecision({ live: 3, budget: 12 }).allowed, true);
  assert.equal(budgetDecision({ live: 3, budget: 12 }).remaining, 9);
  const full = budgetDecision({ live: 12, budget: 12 });
  assert.equal(full.allowed, false);
  assert.equal(full.remaining, 0);
  assert.match(full.message, /12 of 12 WebGL contexts/);
  assert.match(full.message, /delete_offscreen_view/);
});

test("budget: bad inputs never allow more than the budget", () => {
  assert.equal(budgetDecision({ live: Number.NaN, budget: 12 }).allowed, false);
  assert.equal(budgetDecision({ live: -1, budget: 12 }).allowed, false);
  assert.equal(budgetDecision({ live: 20, budget: 12 }).remaining, 0);
});

test("auto-recover: a lost offscreen view is rebuilt once, then rendered", () => {
  let lost = true; let rebuilt = 0;
  const out = renderWithAutoRecover({
    viewId: "v1", kind: "offscreen",
    isLost: () => lost,
    recover: () => { rebuilt += 1; lost = false; },
    render: () => "data:image/png;base64,OK",
  });
  assert.equal(out.dataUrl, "data:image/png;base64,OK");
  assert.equal(out.recovered, true);
  assert.equal(rebuilt, 1);
});

test("auto-recover: a healthy view renders without rebuilding", () => {
  let rebuilt = 0;
  const out = renderWithAutoRecover({ viewId: "v1", kind: "offscreen", isLost: () => false, recover: () => { rebuilt++; }, render: () => "x" });
  assert.deepEqual([out.dataUrl, out.recovered, rebuilt], ["x", false, 0]);
});

test("auto-recover: still lost after one rebuild throws, never loops", () => {
  let rebuilt = 0;
  assert.throws(() => renderWithAutoRecover({ viewId: "v1", kind: "offscreen", isLost: () => true, recover: () => { rebuilt++; }, render: () => "x" }), RendererUnavailableError);
  assert.equal(rebuilt, 1);
});

test("auto-recover: a lost main viewport is not rebuilt; it throws at once", () => {
  let rebuilt = 0;
  assert.throws(() => renderWithAutoRecover({ viewId: "main", kind: "viewport", isLost: () => true, recover: () => { rebuilt++; }, render: () => "x" }), /lost/);
  assert.equal(rebuilt, 0);
});

test("auto-recover: a rebuild that throws surfaces as RendererUnavailableError", () => {
  assert.throws(() => renderWithAutoRecover({ viewId: "v1", kind: "offscreen", isLost: () => true, recover: () => { throw new Error("limit"); }, render: () => "x" }), RendererUnavailableError);
});

test("budget: rebuilding a lost view is allowed at a full budget", () => {
  const d = budgetDecision({ live: 12, budget: 12, replacing: true });
  assert.equal(d.allowed, true);
  assert.match(d.message, /replac/i);
});

test("budget: replacing does not excuse an uncountable total", () => {
  assert.equal(budgetDecision({ live: Number.NaN, budget: 12, replacing: true }).allowed, false);
});

test("expected loss: a view deleted moments ago is not toasted", () => {
  assert.equal(isExpectedLoss(1000, 1500), true);
});

test("expected loss: an old deletion or none at all is a real loss", () => {
  assert.equal(isExpectedLoss(1000, 7000), false);
  assert.equal(isExpectedLoss(undefined, 1500), false);
});
