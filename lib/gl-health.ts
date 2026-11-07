/**
 * WebGL context-loss detection and recovery for Blockbench previews.
 *
 * Pure logic: canvases, renderers, clocks and the recovery actions are passed
 * in, so this file has no Blockbench or DOM dependency and runs under
 * `node --test` with fakes. lib/gl-health-blockbench.ts wires it to Blockbench.
 *
 * Why it exists: a lost context makes `canvas.toDataURL()` return a blank
 * frame instead of throwing, so screenshot tools kept "succeeding" while the
 * renderer was dead. Chromium also stops handing out WebGL contexts to a
 * process after repeated GPU failures; then only an app restart helps, and the
 * agent must say so instead of retrying.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 */

/** The parts of an HTML canvas this module listens to. */
export interface IWatchableCanvas {
  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void;
  removeEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void;
}

/** The parts of a three.js WebGLRenderer this module probes. */
export interface IProbeableRenderer {
  getContext?(): { isContextLost?(): boolean } | null | undefined;
}

export type CanvasState = "ok" | "lost" | "restored";

export interface ICanvasStatus {
  id: string;
  state: CanvasState;
  lostCount: number;
  lastLostAt: number | null;
  lastRestoredAt: number | null;
}

export interface IGlHealthMonitor {
  /** Starts watching a canvas; returns a function that stops watching it. Watching the same id twice is a no-op. */
  watch(id: string, canvas: IWatchableCanvas): () => void;
  unwatch(id: string): void;
  status(): ICanvasStatus[];
  /** Ids whose context is currently lost (no restore seen since the last loss). */
  lostIds(): string[];
  dispose(): void;
  /** Calls `listener(id)` on every context loss; returns a function that unsubscribes. */
  onLost(listener: (id: string) => void): () => void;
}

export function createGlHealthMonitor(now: () => number = Date.now): IGlHealthMonitor {
  const lossListeners = new Set<(id: string) => void>();
  const entries = new Map<string, {
    status: ICanvasStatus;
    canvas: IWatchableCanvas;
    onLost: (event: { preventDefault(): void }) => void;
    onRestored: (event: { preventDefault(): void }) => void;
  }>();

  const unwatch = (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;
    entry.canvas.removeEventListener("webglcontextlost", entry.onLost);
    entry.canvas.removeEventListener("webglcontextrestored", entry.onRestored);
    entries.delete(id);
  };

  return {
    watch(id, canvas) {
      if (entries.has(id)) return () => unwatch(id);
      const status: ICanvasStatus = { id, state: "ok", lostCount: 0, lastLostAt: null, lastRestoredAt: null };
      const onLost = (event: { preventDefault(): void }) => {
        // preventDefault tells the browser we want the context back; without it
        // no webglcontextrestored event is ever sent.
        event.preventDefault();
        status.state = "lost";
        status.lostCount += 1;
        status.lastLostAt = now();
        for (const listener of lossListeners) {
          try { listener(id); } catch { /* a failing listener (e.g. a toast) must not stop the others */ }
        }
      };
      const onRestored = () => {
        status.state = "restored";
        status.lastRestoredAt = now();
      };
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      entries.set(id, { status, canvas, onLost, onRestored });
      return () => unwatch(id);
    },
    unwatch,
    status: () => [...entries.values()].map(e => ({ ...e.status })),
    lostIds: () => [...entries.values()].filter(e => e.status.state === "lost").map(e => e.status.id),
    onLost(listener) {
      lossListeners.add(listener);
      return () => { lossListeners.delete(listener); };
    },
    dispose() {
      for (const id of [...entries.keys()]) unwatch(id);
    },
  };
}

/** "lost" when the renderer reports it, "ok" when it reports otherwise, "unknown" when it cannot be asked. */
export function probeRenderer(renderer: IProbeableRenderer | null | undefined): "ok" | "lost" | "unknown" {
  try {
    const gl = renderer?.getContext?.();
    if (!gl || typeof gl.isContextLost !== "function") return "unknown";
    return gl.isContextLost() ? "lost" : "ok";
  } catch {
    return "unknown";
  }
}

/**
 * True when every sampled pixel is identical: what a dead context renders.
 * `pixels` is RGBA bytes (as from readPixels or getImageData). An empty scene
 * is uniform too, so callers only treat this as a failure when the project has
 * elements in view.
 */
export function isUniformFrame(pixels: ArrayLike<number>, samples = 4096): boolean {
  const count = Math.floor(pixels.length / 4);
  if (count === 0) return true;
  const step = Math.max(1, Math.floor(count / samples));
  const r = pixels[0], g = pixels[1], b = pixels[2], a = pixels[3];
  for (let i = step; i < count; i += step) {
    const o = i * 4;
    if (pixels[o] !== r || pixels[o + 1] !== g || pixels[o + 2] !== b || pixels[o + 3] !== a) return false;
  }
  // The stride can skip the last pixel; check it too.
  const last = (count - 1) * 4;
  return pixels[last] === r && pixels[last + 1] === g && pixels[last + 2] === b && pixels[last + 3] === a;
}

/** The parts of a WebGL context used to read back the last frame. */
export interface IReadableGl {
  drawingBufferWidth?: number;
  drawingBufferHeight?: number;
  RGBA?: number;
  UNSIGNED_BYTE?: number;
  readPixels?(x: number, y: number, w: number, h: number, format: number, type: number, out: Uint8Array): void;
}

/**
 * Whether the frame just rendered is one flat colour: true or false when the
 * pixels were read, null when they could not be (no context, no size, no
 * readPixels, or it threw). Unknown is never reported as blank.
 */
export function readFrameBlank(gl: IReadableGl | null | undefined): boolean | null {
  try {
    const width = gl?.drawingBufferWidth;
    const height = gl?.drawingBufferHeight;
    if (!gl || !width || !height || typeof gl.readPixels !== "function" || gl.RGBA === undefined || gl.UNSIGNED_BYTE === undefined) {
      return null;
    }
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return isUniformFrame(pixels);
  } catch {
    return null;
  }
}

export type FrameVerdict = "ok" | "throw_lost" | "record_blank";

/**
 * What the render path does with a frame it just rendered: refuse it when the
 * context is lost; record a flat frame of a project that has elements (it can
 * be legitimate, e.g. the camera aims at empty space); otherwise accept it.
 */
export function judgeFrame(input: { blank: boolean | null; lostAfter: boolean; elementCount: number }): FrameVerdict {
  if (input.lostAfter) return "throw_lost";
  if (input.blank === true && input.elementCount > 0) return "record_blank";
  return "ok";
}

export type RecoveryOutcome = "healthy" | "restored" | "recreated" | "degraded" | "restart_required";

export interface IRecoveryTarget {
  id: string;
  kind: "viewport" | "offscreen";
  renderer: IProbeableRenderer | null | undefined;
}

export interface IRecoveryDeps {
  monitor: IGlHealthMonitor;
  targets(): IRecoveryTarget[];
  /** Can this process still create a brand-new WebGL context? False means Chromium has blocked WebGL. */
  probeFreshContext(): boolean;
  /** Disposes an offscreen view and creates it again with the same id, size and camera. */
  recreateOffscreen(id: string): void;
  sleep(ms: number): Promise<void>;
  /** How long to wait for the browser's own webglcontextrestored event. */
  restoreTimeoutMs?: number;
  pollMs?: number;
}

export interface IRecoveryReport {
  outcome: RecoveryOutcome;
  lostBefore: string[];
  restored: string[];
  recreated: string[];
  stillLost: string[];
  freshContextAvailable: boolean | null;
  message: string;
}

const RESTART_MESSAGE =
  "WebGL is no longer available to Blockbench. Save the project (File > Save), then quit and reopen Blockbench. Rendering tools will fail until then.";

function lostTargets(deps: IRecoveryDeps): IRecoveryTarget[] {
  const flagged = new Set(deps.monitor.lostIds());
  return deps.targets().filter(t => flagged.has(t.id) || probeRenderer(t.renderer) === "lost");
}

/**
 * Recovery ladder:
 * 1. nothing lost → healthy;
 * 2. wait for the browser to restore the contexts (three.js re-initialises on
 *    webglcontextrestored) → restored;
 * 3. if a fresh context can still be created, rebuild lost offscreen views → recreated;
 *    a lost main viewport cannot be rebuilt from a plugin → degraded;
 * 4. no fresh context at all → restart_required.
 * Never calls WEBGL_lose_context.restoreContext(): it only undoes a loss that
 * the same extension caused and throws otherwise.
 */
export async function recoverRenderers(deps: IRecoveryDeps): Promise<IRecoveryReport> {
  const before = lostTargets(deps);
  const lostBefore = before.map(t => t.id);
  if (before.length === 0) {
    return { outcome: "healthy", lostBefore, restored: [], recreated: [], stillLost: [], freshContextAvailable: null, message: "All watched WebGL contexts are alive." };
  }

  const timeout = deps.restoreTimeoutMs ?? 3000;
  const poll = deps.pollMs ?? 250;
  for (let waited = 0; waited < timeout && lostTargets(deps).length > 0; waited += poll) {
    await deps.sleep(poll);
  }
  let still = lostTargets(deps);
  const restored = lostBefore.filter(id => !still.some(t => t.id === id));
  if (still.length === 0) {
    return { outcome: "restored", lostBefore, restored, recreated: [], stillLost: [], freshContextAvailable: null, message: "The browser restored every lost WebGL context." };
  }

  const fresh = deps.probeFreshContext();
  if (!fresh) {
    return { outcome: "restart_required", lostBefore, restored, recreated: [], stillLost: still.map(t => t.id), freshContextAvailable: false, message: RESTART_MESSAGE };
  }

  const recreated: string[] = [];
  const failed: string[] = [];
  for (const target of still.filter(t => t.kind === "offscreen")) {
    try {
      deps.recreateOffscreen(target.id);
      deps.monitor.unwatch(target.id);
      recreated.push(target.id);
    } catch {
      failed.push(target.id);
    }
  }
  still = lostTargets(deps).filter(t => !recreated.includes(t.id));
  const stillLost = [...new Set([...still.map(t => t.id), ...failed])];

  if (stillLost.length === 0) {
    return { outcome: "recreated", lostBefore, restored, recreated, stillLost, freshContextAvailable: true, message: `Rebuilt ${recreated.length} offscreen view(s).` };
  }
  return {
    outcome: "degraded", lostBefore, restored, recreated, stillLost, freshContextAvailable: true,
    message: `Still lost: ${stillLost.join(", ")}. Offscreen views can render (create one with create_offscreen_view). ` +
      "The main viewport stays dark until Blockbench is restarted; save first.",
  };
}

/** Error thrown by render paths when the renderer is dead, so agents stop retrying. */
export class RendererUnavailableError extends Error {
  readonly outcome: "lost" | "blank";
  constructor(outcome: "lost" | "blank", viewId: string) {
    super(outcome === "lost"
      ? `The WebGL context of view "${viewId}" is lost; this frame would be blank. Run recover_renderer, and restart Blockbench if it reports restart_required.`
      : `View "${viewId}" rendered a blank frame although the project has elements. The renderer may be unhealthy; run render_health.`);
    this.name = "RendererUnavailableError";
    this.outcome = outcome;
  }
}

/**
 * Chromium keeps at most about 16 live WebGL contexts per page and silently
 * drops the oldest when a new one is made, which can kill the main viewport.
 * The budget leaves headroom for Blockbench and other plugins.
 */
export const DEFAULT_CONTEXT_BUDGET = 12;

export interface IBudgetDecision {
  allowed: boolean;
  remaining: number;
  message: string;
}

/** Whether one more WebGL context fits the budget. Unreadable counts are refused. */
export function budgetDecision(input: { live: number; budget: number; replacing?: boolean }): IBudgetDecision {
  const { live, budget } = input;
  if (!Number.isFinite(live) || live < 0) {
    return { allowed: false, remaining: 0, message: "Could not count the live WebGL contexts, so no new one is created." };
  }
  // A lost context is not counted, so rebuilding a lost view leaves the total unchanged.
  if (input.replacing) {
    return { allowed: true, remaining: Math.max(0, budget - live), message: `Replacing a lost view; ${live} of ${budget} WebGL contexts in use.` };
  }
  const remaining = Math.max(0, budget - live);
  return remaining > 0
    ? { allowed: true, remaining, message: `${live} of ${budget} WebGL contexts in use.` }
    : { allowed: false, remaining: 0, message: `${live} of ${budget} WebGL contexts in use. Creating another could make Chromium drop the main viewport's context; delete one with delete_offscreen_view first.` };
}

/**
 * Renders a view, rebuilding a lost offscreen view once first. A lost main
 * viewport cannot be rebuilt by a plugin, so it fails at once.
 */
export function renderWithAutoRecover(input: {
  viewId: string;
  kind: "viewport" | "offscreen";
  isLost(): boolean;
  recover(): void;
  render(): string;
}): { dataUrl: string; recovered: boolean } {
  if (!input.isLost()) return { dataUrl: input.render(), recovered: false };
  if (input.kind !== "offscreen") throw new RendererUnavailableError("lost", input.viewId);
  try {
    input.recover();
  } catch {
    throw new RendererUnavailableError("lost", input.viewId);
  }
  if (input.isLost()) throw new RendererUnavailableError("lost", input.viewId);
  return { dataUrl: input.render(), recovered: true };
}

/** Window after a deliberate delete in which a context loss is expected, not news. */
export const EXPECTED_LOSS_WINDOW_MS = 5000;

/** True when the view was deleted on purpose moments ago, so its context loss needs no toast. */
export function isExpectedLoss(deletedAt: number | undefined, now: number, windowMs = EXPECTED_LOSS_WINDOW_MS): boolean {
  return deletedAt !== undefined && now - deletedAt >= 0 && now - deletedAt < windowMs;
}
