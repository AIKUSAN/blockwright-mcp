/// <reference types="three" />
/// <reference types="blockbench-types" />
/**
 * Quality tools: find_overlaps (z-fighting and interpenetration, rotated cubes
 * included) and compare_silhouette (model render against a reference image).
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as Three from "three";
import { createTool, type IToolSpec } from "@/lib/factories";
import { STATUS_EXPERIMENTAL } from "@/lib/constants";
import { imageContent } from "@/lib/util";
import { applyImageOutput } from "@/lib/image-output";
import { createJsonResult } from "@/lib/tool-results";
import { imageOutputShape } from "@/lib/zodObjects";
import { canCreateOffscreenView, createOffscreenView, deleteOffscreenView, loadViewAngle, renderViewToDataUrl, resolveView } from "@/lib/views";
import { boxFromMatrix, findOverlaps, type V3 } from "@/lib/overlap";
import { REVIEW_VIEW_NAMES, type ReviewViewName, type Vec3 } from "@/lib/orientation";
import { planReviewSheet, type IBounds } from "@/lib/review-sheet";
import { compareMasks, cropAndFit, diffImage, maskFromRGBA } from "@/lib/silhouette";

declare const THREE: typeof Three;

const overlapParameters = z.object({
  include_volume_overlaps: z.boolean().optional().default(true)
    .describe("Also list cubes whose volumes intersect (often intended, e.g. a detail sunk into a body)."),
  nudge: z.number().positive().max(1).optional().default(0.01).describe("Outward offset suggested for each z-fighting pair."),
  limit: z.number().int().min(1).max(500).optional().default(100).describe("Most results listed per kind."),
});

const silhouetteParameters = z.object({
  reference: z.string().min(1)
    .describe("Absolute path of a PNG/JPEG Blockbench can read (on macOS usually under ~/Downloads), or the id or name of a reference loaded with load_reference."),
  view: z.enum(REVIEW_VIEW_NAMES).optional().default("front")
    .describe("View of the model that the reference shows, in the model's own frame (front = its face, -Z)."),
  size: z.number().int().min(64).max(512).optional().default(256).describe("Side of the square masks compared, in pixels."),
  fov: z.number().min(5).max(60).optional().default(12).describe("Camera field of view; small values approach an orthographic drawing."),
  ...imageOutputShape,
});

const overlapSpec: IToolSpec = {
  name: "find_overlaps",
  condition: () => ModelProject.all.length > 0,
  description:
    "Finds z-fighting (faces of different cubes in the same plane, facing the same way, overlapping by an area) and cubes whose volumes intersect. " +
    "Uses each cube's world transform, so rotated cubes, rotated groups and inflate count. Read-only; each z-fighting pair gets a suggested outward offset for the smaller part.",
  annotations: { title: "Find Overlaps and Z-Fighting", readOnlyHint: true },
  parameters: overlapParameters,
  status: STATUS_EXPERIMENTAL,
};

const silhouetteSpec: IToolSpec = {
  name: "compare_silhouette",
  condition: () => ModelProject.all.length > 0,
  description:
    "Renders the model offscreen from one view, cuts out its silhouette and the reference image's, scales both to the same box and returns " +
    "one image (reference | model | difference: grey both, red model only, blue reference only) with IoU overall and per 3x3 region. The user's camera does not move.",
  annotations: { title: "Compare Silhouette", readOnlyHint: true },
  parameters: silhouetteParameters,
  status: STATUS_EXPERIMENTAL,
};

export const qualityToolDocs: IToolSpec[] = [overlapSpec, silhouetteSpec];

function cubeBoxes() {
  return Cube.all.map(cube => {
    const mesh = Reflect.get(cube, "mesh") as Three.Object3D | undefined;
    const inflate = Number(cube.inflate) || 0;
    const half = [0, 1, 2].map(i => Math.abs(cube.to[i] - cube.from[i]) / 2 + inflate) as V3;
    const localCenter = [0, 1, 2].map(i => (cube.from[i] + cube.to[i]) / 2 - cube.origin[i]) as V3;
    if (!mesh) return boxFromMatrix(cube.name, localCenter, half, [NaN]);
    mesh.updateMatrixWorld(true);
    return boxFromMatrix(cube.name, localCenter, half, Array.from(mesh.matrixWorld.elements));
  });
}

function modelBounds(): IBounds | null {
  const root: unknown = Reflect.get(Project ?? {}, "model_3d");
  if (!(root instanceof THREE.Object3D)) return null;
  const box = new THREE.Box3().setFromObject(root);
  return box.isEmpty() ? null : { min: box.min.toArray() as Vec3, max: box.max.toArray() as Vec3 };
}

async function decode(dataUrl: string): Promise<{ data: Uint8ClampedArray; width: number; height: number; image: HTMLImageElement }> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch (error) {
    throw new Error(`The image is not a readable PNG, JPEG or WebP file (${String(error)}).`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context.");
  ctx.drawImage(image, 0, 0);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, image };
}

function referenceDataUrl(reference: string): string {
  const loaded = (Reflect.get(globalThis, "__BLOCKWRIGHT_SOSADLY__") as { references?: { id?: string; name?: string; data_url?: string }[] } | undefined)?.references
    ?.find(r => r.id === reference || r.name === reference);
  if (loaded?.data_url) return loaded.data_url;
  // @ts-ignore - requireNativeModule is a Blockbench global
  const fs = requireNativeModule("fs") as { readFileSync(path: string): Uint8Array };
  let bytes: Uint8Array;
  try {
    bytes = fs.readFileSync(reference);
  } catch (error) {
    throw new Error(`Could not read the reference "${reference}" (${String(error)}). On macOS Blockbench can usually read only ~/Downloads unless it has been given access to other folders.`);
  }
  const mime = /\.jpe?g$/i.test(reference) ? "image/jpeg" : /\.webp$/i.test(reference) ? "image/webp" : "image/png";
  let binary = "";
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return `data:${mime};base64,${btoa(binary)}`;
}

function maskCanvas(rgba: Uint8ClampedArray, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), size, size), 0, 0);
  return canvas;
}

async function compareSilhouette(args: z.infer<typeof silhouetteParameters>, owner?: string): Promise<CallToolResult> {
  const ref = await decode(referenceDataUrl(args.reference));
  if (!canCreateOffscreenView()) throw new Error("No offscreen view slot is free; delete one with delete_offscreen_view first.");
  const facing: unknown = Reflect.get(Format ?? {}, "forward_direction");
  const plan = planReviewSheet({
    views: [args.view as ReviewViewName],
    bounds: modelBounds() ?? { min: [NaN, NaN, NaN], max: [NaN, NaN, NaN] },
    cellSize: 512, fov: args.fov, forwardDirection: typeof facing === "string" ? facing : null,
  });
  const viewId = `silhouette_${Date.now().toString(36)}`;
  createOffscreenView({ id: viewId, width: 512, height: 512, antialias: false, copyFrom: "none", owner });
  let render: string;
  try {
    const preview = resolveView(viewId);
    const cell = plan.cells[0];
    loadViewAngle(preview, { position: cell.camera.position, target: cell.camera.target, projection: "perspective", fov: cell.camera.fov });
    render = renderViewToDataUrl(preview);
  } finally {
    deleteOffscreenView(viewId);
  }
  const model = await decode(render);
  const size = args.size;
  const modelMask = cropAndFit(maskFromRGBA(model.data, model.width, model.height).mask, model.width, model.height, size);
  const refMaskInfo = maskFromRGBA(ref.data, ref.width, ref.height);
  const refMask = cropAndFit(refMaskInfo.mask, ref.width, ref.height, size);
  const result = compareMasks(modelMask, refMask, size);

  const bar = 22;
  const sheet = document.createElement("canvas");
  sheet.width = size * 3; sheet.height = size + bar;
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = "#1e1f22"; ctx.fillRect(0, 0, sheet.width, sheet.height);
  const fit = (img: CanvasImageSource, w: number, h: number, x: number) => {
    const s = Math.min(size / w, size / h);
    ctx.drawImage(img, x + (size - w * s) / 2, bar + (size - h * s) / 2, w * s, h * s);
  };
  fit(ref.image, ref.width, ref.height, 0);
  fit(model.image, model.width, model.height, size);
  ctx.drawImage(maskCanvas(diffImage(modelMask, refMask, size), size), size * 2, bar);
  ctx.fillStyle = "#f2f3f5"; ctx.font = "bold 13px sans-serif"; ctx.textBaseline = "middle";
  ["REFERENCE", `MODEL (${args.view.toUpperCase()})`, `DIFF  IoU ${result.iou}`].forEach((t, i) => ctx.fillText(t, i * size + 8, bar / 2));

  const summary = {
    view: args.view,
    iou: result.iou,
    reference_mask: refMaskInfo.mode,
    model_only_pixels: result.onlyModel,
    reference_only_pixels: result.onlyReference,
    worst_regions: result.worst.slice(0, 4),
    legend: "grey: both; red: model only (too much); blue: reference only (missing on the model)",
  };
  const image = await applyImageOutput(imageContent(sheet.toDataURL("image/png"), "image/png"), { max_size: args.max_size, format: args.format });
  return { content: [...image.content, { type: "text", text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
}

export function registerQualityTools() {
  createTool(overlapSpec.name, {
    ...overlapSpec,
    async execute({ include_volume_overlaps, nudge, limit }: z.infer<typeof overlapParameters>) {
      const report = findOverlaps(cubeBoxes(), { nudge });
      return createJsonResult({
        cubes_checked: report.checked,
        cubes_skipped: report.skipped,
        z_fighting_count: report.zFighting.length,
        z_fighting: report.zFighting.slice(0, limit),
        ...(include_volume_overlaps ? { volume_overlap_count: report.volumeOverlaps.length, volume_overlaps: report.volumeOverlaps.slice(0, limit) } : {}),
      });
    },
  }, overlapSpec.status);

  createTool(silhouetteSpec.name, {
    ...silhouetteSpec,
    async execute(args: z.infer<typeof silhouetteParameters>, context) {
      return compareSilhouette(args, context?.sessionId);
    },
  }, silhouetteSpec.status);
}
