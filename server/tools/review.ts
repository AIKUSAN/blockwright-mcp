/// <reference types="three" />
/// <reference types="blockbench-types" />
/**
 * Review and renderer-health tools: render_review_sheet, render_health,
 * recover_renderer.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 * The view labels use lib/orientation.ts (portions MIT, Copyright (c) 2026 sosadly).
 */
import { z } from "zod";
import type * as Three from "three";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTool, type IToolSpec } from "@/lib/factories";
import { STATUS_EXPERIMENTAL } from "@/lib/constants";
import { imageContent } from "@/lib/util";
import { applyImageOutput } from "@/lib/image-output";
import { createJsonResult } from "@/lib/tool-results";
import { imageOutputShape } from "@/lib/zodObjects";
import {
  canCreateOffscreenView, createOffscreenView, deleteOffscreenView, loadViewAngle, renderViewToDataUrl, resolveView,
} from "@/lib/views";
import { REVIEW_VIEW_NAMES, type ReviewViewName, type Vec3 } from "@/lib/orientation";
import {
  composeReviewSheet, DEFAULT_REVIEW_VIEWS, planReviewSheet, relabelCell, type IBounds, type ISheetCanvas,
} from "@/lib/review-sheet";
import { recoverRendererNow, renderHealthReport } from "@/lib/gl-health-blockbench";

declare const THREE: typeof Three;

const reviewSheetParameters = z.object({
  views: z.array(z.enum(REVIEW_VIEW_NAMES)).min(1).max(12).optional()
    .describe(`Views in reading order. Default: ${DEFAULT_REVIEW_VIEWS.join(", ")}. Named from the model's own frame: "right" is the camera on the model's right side.`),
  cell_size: z.number().int().min(128).max(1024).optional().default(384).describe("Pixel size of each square view."),
  columns: z.number().int().min(1).max(6).optional().default(3),
  fov: z.number().min(10).max(90).optional().default(30).describe("Perspective field of view in degrees."),
  ...imageOutputShape,
});
type ReviewSheetArgs = z.infer<typeof reviewSheetParameters>;

const recoverParameters = z.object({
  restore_timeout_ms: z.number().int().min(0).max(15000).optional().default(3000)
    .describe("How long to wait for the browser to restore a lost context before rebuilding views."),
});

const reviewSheetSpec: IToolSpec = {
  name: "render_review_sheet",
  condition: () => ModelProject.all.length > 0,
  description:
    "Renders several views of the open model into ONE labelled PNG (default front, back, right, left, top, front-right). " +
    "Uses a temporary offscreen view, so the user's camera never moves. Each cell's bottom bar marks which image edge " +
    "shows the model's own RIGHT and LEFT (the model faces -Z, its right is +X; a front view is mirrored).",
  annotations: { title: "Render Review Sheet", readOnlyHint: true },
  parameters: reviewSheetParameters,
  status: STATUS_EXPERIMENTAL,
};

const renderHealthSpec: IToolSpec = {
  name: "render_health",
  description:
    "Reports whether each viewport's and offscreen view's WebGL context is alive, how often it was lost, and whether " +
    "Blockbench can still create a new WebGL context. Call it when screenshots come back blank.",
  annotations: { title: "Render Health", readOnlyHint: true },
  parameters: z.object({}),
  status: STATUS_EXPERIMENTAL,
};

const recoverSpec: IToolSpec = {
  name: "recover_renderer",
  description:
    "Tries to bring lost WebGL contexts back: waits for the browser to restore them, then rebuilds lost offscreen views. " +
    "Returns outcome healthy, restored, recreated, degraded (main viewport still dark) or restart_required " +
    "(tell the user to save and restart Blockbench; do not retry renders until then).",
  annotations: { title: "Recover Renderer", readOnlyHint: false },
  parameters: recoverParameters,
  status: STATUS_EXPERIMENTAL,
};

export const reviewToolDocs: IToolSpec[] = [reviewSheetSpec, renderHealthSpec, recoverSpec];

/** World-space bounds of the visible model, rotation included; null when empty. */
function modelBounds(): IBounds | null {
  const root: unknown = Reflect.get(Project ?? {}, "model_3d");
  if (!(root instanceof THREE.Object3D)) return null;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  return { min: box.min.toArray() as Vec3, max: box.max.toArray() as Vec3 };
}

/** The image's right-hand direction in world space, from the camera Blockbench actually rendered with. */
function cameraScreenRight(preview: Preview): Vec3 {
  const camera = preview.camera;
  camera.updateMatrixWorld();
  return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize().toArray() as Vec3;
}

function forwardDirection(): string | null {
  const value: unknown = Reflect.get(Format ?? {}, "forward_direction");
  return typeof value === "string" ? value : null;
}

const domCanvas = (width: number, height: number): ISheetCanvas => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as ISheetCanvas;
};

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
}

async function renderReviewSheet(args: ReviewSheetArgs, owner?: string): Promise<CallToolResult> {
  if (!canCreateOffscreenView()) {
    throw new Error("No offscreen view slot is free; delete one with delete_offscreen_view first.");
  }
  const facing = forwardDirection();
  let plan = planReviewSheet({
    views: args.views ?? DEFAULT_REVIEW_VIEWS,
    bounds: modelBounds() ?? { min: [NaN, NaN, NaN], max: [NaN, NaN, NaN] },
    cellSize: args.cell_size,
    columns: args.columns,
    fov: args.fov,
    forwardDirection: facing,
  });

  // One offscreen view for every angle: each extra view would cost a WebGL
  // context, and Chromium evicts the oldest context when there are too many.
  const viewId = `review_sheet_${Date.now().toString(36)}`;
  createOffscreenView({ id: viewId, width: plan.cellSize, height: plan.cellSize, antialias: true, copyFrom: "none", owner });
  const renders = new Map<ReviewViewName, string>();
  try {
    plan = {
      ...plan,
      cells: plan.cells.map(cell => {
        // Resolve per cell: a lost view is rebuilt into a new Preview mid-sheet.
        const preview = resolveView(viewId);
        loadViewAngle(preview, {
          position: cell.camera.position,
          target: cell.camera.target,
          projection: "perspective",
          fov: cell.camera.fov,
        });
        renders.set(cell.view, renderViewToDataUrl(preview));
        return relabelCell(cell, cameraScreenRight(preview), facing);
      }),
    };
  } finally {
    deleteOffscreenView(viewId);
  }

  const sheet = await composeReviewSheet(plan, renders, { createCanvas: domCanvas, loadImage });
  const summary = {
    facing: plan.facing,
    model_right_axis: plan.rightAxis,
    cells: plan.cells.map(c => ({ view: c.view, column: c.column, row: c.row, model_right_on: c.label.modelRightOn, mirrored: c.label.mirrored })),
  };
  const image = await applyImageOutput(imageContent(sheet, "image/png"), { max_size: args.max_size, format: args.format });
  return {
    content: [...image.content, { type: "text", text: JSON.stringify(summary, null, 2) }],
    structuredContent: summary,
  };
}

export function registerReviewTools() {
  createTool(reviewSheetSpec.name, {
    ...reviewSheetSpec,
    async execute(args: ReviewSheetArgs, context) {
      return renderReviewSheet(args, context?.sessionId);
    },
  }, reviewSheetSpec.status);

  createTool(renderHealthSpec.name, {
    ...renderHealthSpec,
    async execute() {
      return createJsonResult(renderHealthReport());
    },
  }, renderHealthSpec.status);

  createTool(recoverSpec.name, {
    ...recoverSpec,
    async execute({ restore_timeout_ms }: z.infer<typeof recoverParameters>) {
      return createJsonResult({ ...await recoverRendererNow(restore_timeout_ms) });
    },
  }, recoverSpec.status);
}
