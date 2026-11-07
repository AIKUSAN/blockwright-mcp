/// <reference types="three" />
/// <reference types="blockbench-types" />
/**
 * Wires lib/gl-health.ts to Blockbench: watches every preview canvas for
 * WebGL context loss and runs the recovery ladder on request; shows a toast
 * on every loss and reports the WebGL context budget.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 */
import {
  createGlHealthMonitor, probeRenderer, recoverRenderers,
  type IGlHealthMonitor, type IRecoveryReport, type IRecoveryTarget,
} from "@/lib/gl-health";
import { lastAutoRecovered, lastBlankFrames, listOffscreenRenderTargets, liveContextCount, recentlyDeleted, recreateOffscreenView } from "@/lib/views";
import { DEFAULT_CONTEXT_BUDGET, budgetDecision, isExpectedLoss } from "@/lib/gl-health";
import { PRODUCT_NAME } from "@/lib/constants";

let monitor: IGlHealthMonitor | undefined;
let rescanTimer: ReturnType<typeof setInterval> | undefined;

/** Must match OFFSCREEN_PREVIEW_ID_PREFIX in lib/views.ts. */
const OFFSCREEN_PREFIX = "mcp_offscreen_";
/** Monitor key for a preview: the agent-facing view id, so it lines up with recovery targets. */
const targetId = (previewId: unknown) => {
  const id = String(previewId);
  return id.startsWith(OFFSCREEN_PREFIX) ? id.slice(OFFSCREEN_PREFIX.length) : id;
};

/** Blockbench viewports (Preview.all minus our offscreen ones), as recovery targets. */
function viewportTargets(): IRecoveryTarget[] {
  return Preview.all
    .filter(preview => !String(preview.id).startsWith(OFFSCREEN_PREFIX))
    .map(preview => ({ id: String(preview.id), kind: "viewport", renderer: Reflect.get(preview, "renderer") as IRecoveryTarget["renderer"] }));
}

function allTargets(): IRecoveryTarget[] {
  return [...viewportTargets(), ...listOffscreenRenderTargets()];
}

/** Attaches listeners to canvases created since the last scan (Blockbench adds previews at runtime). */
function rescan(): void {
  if (!monitor) return;
  // Disposal forces a context loss on purpose; forget previews that are gone.
  const live = new Set(Preview.all.map(preview => targetId(preview.id)));
  for (const status of monitor.status()) if (!live.has(status.id)) monitor.unwatch(status.id);
  for (const preview of Preview.all) {
    const canvas = Reflect.get(preview, "canvas") as HTMLCanvasElement | undefined;
    if (canvas && typeof canvas.addEventListener === "function") monitor.watch(targetId(preview.id), canvas);
  }
}

/** Tells the user about a context loss right away, inside Blockbench. */
function toastLoss(id: string): void {
  // delete_offscreen_view and the rebuild after a loss force a loss on purpose.
  if (isExpectedLoss(recentlyDeleted.get(id), Date.now())) return;
  const offscreen = listOffscreenRenderTargets().some(t => t.id === id);
  const text = offscreen
    ? `${PRODUCT_NAME}: WebGL was lost in view "${id}". It is rebuilt automatically on the next render.`
    : `${PRODUCT_NAME}: WebGL was lost in the "${id}" viewport. Save your project; if the view stays black, restart Blockbench.`;
  const show = Reflect.get(Blockbench, "showToastNotification") as ((o: object) => unknown) | undefined;
  if (typeof show === "function") show.call(Blockbench, { text, icon: "warning", color: "#e0922f", expire: 15000 });
  else Blockbench.showQuickMessage(text, 6000);
}

export function setupGlHealth(): void {
  monitor = createGlHealthMonitor();
  monitor.onLost(toastLoss);
  rescan();
  rescanTimer = setInterval(rescan, 5000);
}

export function teardownGlHealth(): void {
  if (rescanTimer) clearInterval(rescanTimer);
  rescanTimer = undefined;
  monitor?.dispose();
  monitor = undefined;
}

/** Can this process still create a new WebGL context? Frees the test context at once. */
export function probeFreshContext(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl || gl.isContextLost()) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function renderHealthReport() {
  rescan();
  const watched = new Map((monitor?.status() ?? []).map(s => [s.id, s]));
  return {
    targets: allTargets().map(t => ({
      id: t.id,
      kind: t.kind,
      context: probeRenderer(t.renderer),
      events: watched.get(t.id) ?? null,
      last_blank_frame_at: lastBlankFrames.get(t.id) ?? null,
    })),
    fresh_context_available: probeFreshContext(),
    context_budget: budgetDecision({ live: liveContextCount(), budget: DEFAULT_CONTEXT_BUDGET }),
    auto_recovered: Object.fromEntries(lastAutoRecovered),
    note: "context 'lost' or fresh_context_available false means renders will be blank; run recover_renderer.",
  };
}

export async function recoverRendererNow(restoreTimeoutMs?: number): Promise<IRecoveryReport> {
  if (!monitor) setupGlHealth();
  rescan();
  return recoverRenderers({
    monitor: monitor!,
    targets: allTargets,
    probeFreshContext,
    recreateOffscreen: id => { recreateOffscreenView(id); },
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    restoreTimeoutMs,
  });
}
