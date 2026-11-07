// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGlHealthMonitor, probeRenderer, isUniformFrame, recoverRenderers, RendererUnavailableError,
  readFrameBlank, judgeFrame, type IRecoveryTarget, type IRecoveryDeps,
} from "../lib/gl-health.ts";

type Listener = (event: { preventDefault(): void }) => void;
function fakeCanvas() {
  const listeners = new Map<string, Set<Listener>>();
  let prevented = 0;
  return {
    addEventListener(type: string, fn: Listener) { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn); },
    removeEventListener(type: string, fn: Listener) { listeners.get(type)?.delete(fn); },
    fire(type: string) { for (const fn of listeners.get(type) ?? []) fn({ preventDefault: () => { prevented += 1; } }); },
    count: (type: string) => listeners.get(type)?.size ?? 0,
    get prevented() { return prevented; },
  };
}
const renderer = (lost: { value: boolean }) => ({ getContext: () => ({ isContextLost: () => lost.value }) });

test("monitor records loss with preventDefault, then restore", () => {
  let t = 100;
  const m = createGlHealthMonitor(() => t);
  const c = fakeCanvas();
  m.watch("main", c);
  c.fire("webglcontextlost");
  assert.equal(c.prevented, 1, "must preventDefault or the browser never restores");
  assert.deepEqual(m.lostIds(), ["main"]);
  assert.equal(m.status()[0].lastLostAt, 100);
  t = 250;
  c.fire("webglcontextrestored");
  assert.deepEqual(m.lostIds(), []);
  assert.equal(m.status()[0].state, "restored");
  assert.equal(m.status()[0].lostCount, 1);
});

test("watching twice adds no second listener; unwatch and dispose remove them", () => {
  const m = createGlHealthMonitor();
  const c = fakeCanvas();
  m.watch("a", c); m.watch("a", c);
  assert.equal(c.count("webglcontextlost"), 1);
  m.dispose();
  assert.equal(c.count("webglcontextlost"), 0);
  assert.deepEqual(m.status(), []);
});

test("repeated losses are counted", () => {
  const m = createGlHealthMonitor();
  const c = fakeCanvas();
  m.watch("a", c);
  for (let i = 0; i < 3; i++) { c.fire("webglcontextlost"); c.fire("webglcontextrestored"); }
  assert.equal(m.status()[0].lostCount, 3);
});

test("probeRenderer: ok, lost, and unknown for missing, broken or throwing renderers", () => {
  assert.equal(probeRenderer(renderer({ value: false })), "ok");
  assert.equal(probeRenderer(renderer({ value: true })), "lost");
  assert.equal(probeRenderer(null), "unknown");
  assert.equal(probeRenderer({ getContext: () => null }), "unknown");
  assert.equal(probeRenderer({ getContext: () => { throw new Error("gone"); } }), "unknown");
});

test("isUniformFrame: blank buffers are uniform, a single different pixel is not", () => {
  const blank = new Uint8ClampedArray(64 * 64 * 4);
  assert.equal(isUniformFrame(blank), true);
  assert.equal(isUniformFrame(new Uint8ClampedArray(0)), true);
  const lastDiffers = new Uint8ClampedArray(blank); lastDiffers[lastDiffers.length - 1] = 255;
  assert.equal(isUniformFrame(lastDiffers), false, "the last pixel is always checked");
  const midDiffers = new Uint8ClampedArray(blank); midDiffers[4 * 100] = 9;
  assert.equal(isUniformFrame(midDiffers, 1_000_000), false);
});

function deps(over: Partial<Omit<IRecoveryDeps, "targets">> & { targets: IRecoveryTarget[] }) {
  const m = createGlHealthMonitor();
  const slept: number[] = [];
  return {
    slept,
    deps: {
      monitor: m,
      probeFreshContext: () => true,
      recreateOffscreen: () => {},
      sleep: async (ms: number) => { slept.push(ms); },
      restoreTimeoutMs: 1000, pollMs: 250,
      ...over,
      targets: () => over.targets,
    },
  };
}

test("recover: nothing lost → healthy, no waiting", async () => {
  const { deps: d, slept } = deps({ targets: [{ id: "main", kind: "viewport", renderer: renderer({ value: false }) }] });
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "healthy");
  assert.equal(slept.length, 0);
});

test("recover: browser restores while we wait → restored", async () => {
  const lost = { value: true };
  const { deps: d } = deps({ targets: [{ id: "main", kind: "viewport", renderer: renderer(lost) }] });
  d.sleep = async () => { lost.value = false; };
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "restored");
  assert.deepEqual(r.restored, ["main"]);
});

test("recover: no fresh context → restart_required with a save-then-restart message", async () => {
  const { deps: d, slept } = deps({ targets: [{ id: "main", kind: "viewport", renderer: renderer({ value: true }) }], probeFreshContext: () => false });
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "restart_required");
  assert.equal(r.freshContextAvailable, false);
  assert.match(r.message, /Save the project.*reopen Blockbench/);
  assert.equal(slept.reduce((a, b) => a + b, 0), 1000, "waits the full timeout once, no endless retry");
});

test("recover: lost offscreen view is rebuilt → recreated", async () => {
  const lost = { value: true };
  const rebuilt: string[] = [];
  const { deps: d } = deps({
    targets: [{ id: "view_1", kind: "offscreen", renderer: renderer(lost) }],
    recreateOffscreen: id => { rebuilt.push(id); lost.value = false; },
  });
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "recreated");
  assert.deepEqual(rebuilt, ["view_1"]);
});

test("recover: lost main viewport with WebGL still available → degraded, never claims success", async () => {
  const { deps: d } = deps({
    targets: [
      { id: "main", kind: "viewport", renderer: renderer({ value: true }) },
      { id: "view_1", kind: "offscreen", renderer: renderer({ value: false }) },
    ],
  });
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "degraded");
  assert.deepEqual(r.stillLost, ["main"]);
  assert.match(r.message, /restarted/);
});

test("recover: a rebuild that throws is reported as still lost", async () => {
  const { deps: d } = deps({
    targets: [{ id: "view_1", kind: "offscreen", renderer: renderer({ value: true }) }],
    recreateOffscreen: () => { throw new Error("context limit"); },
  });
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "degraded");
  assert.deepEqual(r.stillLost, ["view_1"]);
});

test("recover: loss seen only through the monitor event (renderer cannot be probed) still counts", async () => {
  const c = fakeCanvas();
  const { deps: d } = deps({ targets: [{ id: "main", kind: "viewport", renderer: null }], probeFreshContext: () => false });
  d.monitor.watch("main", c);
  c.fire("webglcontextlost");
  const r = await recoverRenderers(d);
  assert.equal(r.outcome, "restart_required");
});

test("RendererUnavailableError names the view and the next step", () => {
  assert.match(new RendererUnavailableError("lost", "active").message, /"active".*recover_renderer/);
  assert.match(new RendererUnavailableError("blank", "view_2").message, /render_health/);
});

const glWith = (pixels: number[], w: number, h: number) => ({
  drawingBufferWidth: w, drawingBufferHeight: h, RGBA: 1, UNSIGNED_BYTE: 2,
  readPixels: (_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, out: Uint8Array) => { out.set(pixels); },
});

test("readFrameBlank: true for a flat frame, false for a drawn one", () => {
  assert.equal(readFrameBlank(glWith([0, 0, 0, 0, 0, 0, 0, 0], 2, 1)), true);
  assert.equal(readFrameBlank(glWith([0, 0, 0, 0, 9, 9, 9, 255], 2, 1)), false);
});

test("readFrameBlank: unknown is null, never blank (upstream's preview double has no buffer size)", () => {
  assert.equal(readFrameBlank(null), null);
  assert.equal(readFrameBlank({ isContextLost: () => false } as never), null);
  assert.equal(readFrameBlank({ ...glWith([], 0, 0) }), null);
  assert.equal(readFrameBlank({ ...glWith([], 2, 1), readPixels: () => { throw new Error("gone"); } }), null);
});

test("judgeFrame: lost throws; flat frame of a non-empty project is recorded; otherwise ok", () => {
  assert.equal(judgeFrame({ blank: false, lostAfter: true, elementCount: 0 }), "throw_lost");
  assert.equal(judgeFrame({ blank: true, lostAfter: false, elementCount: 3 }), "record_blank");
  assert.equal(judgeFrame({ blank: true, lostAfter: false, elementCount: 0 }), "ok", "empty project renders flat legitimately");
  assert.equal(judgeFrame({ blank: null, lostAfter: false, elementCount: 3 }), "ok", "unreadable pixels are not blank");
});
