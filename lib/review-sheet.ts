/**
 * Review sheet: several views of the model in one labelled PNG.
 *
 * Pure layout and drawing. The canvas, image loading and rendering are passed
 * in, so this file has no Blockbench or DOM dependency and runs under
 * `node --test` with fakes.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 * Uses lib/orientation.ts (portions MIT, Copyright (c) 2026 sosadly).
 */
import {
  add, normalize, orientation, scale, viewDirection, labelView, screenRightFor,
  type IOrientation, type IViewLabel, type ReviewViewName, type Vec3,
} from "./orientation.ts";

export interface IBounds {
  min: Vec3;
  max: Vec3;
}

export interface ISheetCell {
  view: ReviewViewName;
  column: number;
  row: number;
  /** Top-left of the image area inside the sheet (below the caption bar). */
  x: number;
  y: number;
  camera: { position: Vec3; target: Vec3; fov: number };
  /** Label from the planned camera; replace it with the real camera's via relabelCell. */
  label: IViewLabel;
  caption: string;
}

export interface ISheetPlan {
  width: number;
  height: number;
  cellSize: number;
  barHeight: number;
  columns: number;
  rows: number;
  facing: string;
  rightAxis: string;
  cells: ISheetCell[];
}

export interface IPlanOptions {
  views: readonly ReviewViewName[];
  bounds: IBounds;
  cellSize?: number;
  columns?: number;
  fov?: number;
  forwardDirection?: string | null;
  /** Upper bound for the whole sheet, longest side, in pixels. */
  maxSheetSize?: number;
}

export const DEFAULT_REVIEW_VIEWS: readonly ReviewViewName[] = ["front", "back", "right", "left", "top", "front_right"];
const FALLBACK_BOUNDS: IBounds = { min: [-8, 0, -8], max: [8, 16, 8] };

export function isUsableBounds(b: IBounds | null | undefined): b is IBounds {
  if (!b) return false;
  const values = [...b.min, ...b.max];
  return values.every(Number.isFinite) && b.max.every((v, i) => v >= b.min[i]);
}

const VIEW_TITLES: Record<ReviewViewName, string> = {
  front: "FRONT", back: "BACK", right: "RIGHT SIDE", left: "LEFT SIDE", top: "TOP", bottom: "BOTTOM",
  front_right: "FRONT-RIGHT", front_left: "FRONT-LEFT", back_right: "BACK-RIGHT", back_left: "BACK-LEFT",
};

function captionFor(view: ReviewViewName, label: IViewLabel): string {
  const note = label.modelRightOn === "edge_on" ? "" : label.mirrored ? " · mirrored: you face the model" : "";
  return `${VIEW_TITLES[view]}${note}`;
}

/** Plans the grid and one camera per view. Throws on an empty or unknown view list. */
export function planReviewSheet(options: IPlanOptions): ISheetPlan {
  const views = options.views;
  if (views.length === 0) throw new Error("A review sheet needs at least one view.");
  const o: IOrientation = orientation(options.forwardDirection);
  const columns = Math.max(1, Math.min(options.columns ?? 3, views.length));
  const rows = Math.ceil(views.length / columns);
  const maxSheet = options.maxSheetSize ?? 2048;
  let cellSize = Math.round(options.cellSize ?? 384);
  const barFor = (size: number) => Math.max(16, Math.round(size / 16));
  // Shrink cells until the whole sheet fits the cap.
  while (cellSize > 64 && Math.max(columns * cellSize, rows * (cellSize + 2 * barFor(cellSize))) > maxSheet) {
    cellSize -= 16;
  }
  const barHeight = barFor(cellSize);
  const fov = options.fov ?? 30;

  const bounds = isUsableBounds(options.bounds) ? options.bounds : FALLBACK_BOUNDS;
  const center = scale(add(bounds.min, bounds.max), 0.5);
  const half = scale([bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]], 0.5);
  const radius = Math.max(Math.hypot(half[0], half[1], half[2]), 1);
  // Distance at which a sphere of this radius fills the vertical field of view, plus 10 % margin.
  const distance = (radius / Math.sin((fov * Math.PI) / 360)) * 1.1;

  const cells = views.map((view, index): ISheetCell => {
    const dir = viewDirection(view, o);
    const position = add(center, scale(normalize(dir), distance));
    const label = labelView(screenRightFor(position, center), dir, o);
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      view, column, row,
      x: column * cellSize,
      y: row * (cellSize + 2 * barHeight) + barHeight,
      camera: { position, target: center, fov },
      label,
      caption: captionFor(view, label),
    };
  });

  return {
    width: columns * cellSize,
    height: rows * (cellSize + 2 * barHeight),
    cellSize, barHeight, columns, rows,
    facing: o.facing, rightAxis: o.rightAxis,
    cells,
  };
}

/** Replaces a cell's label with one built from the real camera's right-hand direction. */
export function relabelCell(cell: ISheetCell, screenRight: Vec3, forwardDirection?: string | null): ISheetCell {
  const o = orientation(forwardDirection);
  const dir = normalize([
    cell.camera.position[0] - cell.camera.target[0],
    cell.camera.position[1] - cell.camera.target[1],
    cell.camera.position[2] - cell.camera.target[2],
  ]);
  const label = labelView(screenRight, dir, o);
  return { ...cell, label, caption: captionFor(cell.view, label) };
}

/** The subset of CanvasRenderingContext2D the sheet uses. */
export interface ISheetContext {
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
}

export interface ISheetCanvas {
  getContext(kind: "2d"): ISheetContext | null;
  toDataURL(type?: string): string;
}

export interface IComposeDeps {
  createCanvas(width: number, height: number): ISheetCanvas;
  /** Decodes a data URL into something drawImage accepts. */
  loadImage(dataUrl: string): Promise<unknown>;
}

const COLORS = { background: "#1e1f22", bar: "#2b2d31", text: "#f2f3f5", right: "#ffb347", left: "#7ec8ff" };

/** Draws the planned cells and their renders into one PNG data URL. */
export async function composeReviewSheet(
  plan: ISheetPlan,
  renders: ReadonlyMap<ReviewViewName, string>,
  deps: IComposeDeps,
): Promise<string> {
  const canvas = deps.createCanvas(plan.width, plan.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D context for the review sheet.");
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, plan.width, plan.height);
  const pad = Math.round(plan.barHeight * 0.4);
  ctx.font = `bold ${Math.round(plan.barHeight * 0.62)}px sans-serif`;
  ctx.textBaseline = "middle";

  for (const cell of plan.cells) {
    const dataUrl = renders.get(cell.view);
    if (!dataUrl) throw new Error(`Missing render for view "${cell.view}".`);
    const top = cell.y - plan.barHeight;
    const bottom = cell.y + plan.cellSize;
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(cell.x, top, plan.cellSize, plan.barHeight);
    ctx.fillRect(cell.x, bottom, plan.cellSize, plan.barHeight);
    ctx.drawImage(await deps.loadImage(dataUrl), cell.x, cell.y, plan.cellSize, plan.cellSize);

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    ctx.fillText(cell.caption, cell.x + pad, top + plan.barHeight / 2);

    const mid = bottom + plan.barHeight / 2;
    if (cell.label.leftEdge) {
      ctx.fillStyle = cell.label.leftEdge.includes("RIGHT") ? COLORS.right : COLORS.left;
      ctx.textAlign = "left";
      ctx.fillText(`◀ ${cell.label.leftEdge}`, cell.x + pad, mid);
    }
    if (cell.label.rightEdge) {
      ctx.fillStyle = cell.label.rightEdge.includes("RIGHT") ? COLORS.right : COLORS.left;
      ctx.textAlign = "right";
      ctx.fillText(`${cell.label.rightEdge} ▶`, cell.x + plan.cellSize - pad, mid);
    }
  }
  return canvas.toDataURL("image/png");
}
