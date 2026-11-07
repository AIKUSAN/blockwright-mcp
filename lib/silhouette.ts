/**
 * Silhouette comparison between a model render and a reference image.
 * Masks are 0/1 bytes, row-major. Pure logic; runs under `node --test`.
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */

export interface IMask {
  mask: Uint8Array;
  mode: "alpha" | "background";
}

/**
 * Foreground mask of an RGBA image. With any transparency the alpha channel
 * decides; otherwise pixels far from the corners' colour are foreground.
 */
export function maskFromRGBA(data: ArrayLike<number>, width: number, height: number, threshold = 48): IMask {
  const n = width * height;
  const mask = new Uint8Array(n);
  let transparent = false;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 250) { transparent = true; break; }
  if (transparent) {
    for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
    return { mask, mode: "alpha" };
  }
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const bg = [0, 1, 2].map(c => {
    const values = corners.map(i => data[i * 4 + c]).sort((a, b) => a - b);
    return (values[1] + values[2]) / 2; // median of four
  });
  for (let i = 0; i < n; i++) {
    const d = Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2]);
    mask[i] = d > threshold ? 1 : 0;
  }
  return { mask, mode: "background" };
}

/** Crops a mask to its bounding box and fits it, centred and aspect-kept, into size×size. */
export function cropAndFit(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const out = new Uint8Array(size * size);
  if (x1 < 0) return out;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const scale = size / Math.max(bw, bh);
  const offX = (size - bw * scale) / 2, offY = (size - bh * scale) / 2;
  for (let oy = 0; oy < size; oy++) for (let ox = 0; ox < size; ox++) {
    const sx = Math.floor((ox + 0.5 - offX) / scale), sy = Math.floor((oy + 0.5 - offY) / scale);
    if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) continue;
    out[oy * size + ox] = mask[(y0 + sy) * width + (x0 + sx)];
  }
  return out;
}

const ROWS = ["top", "middle", "bottom"];
const COLS = ["left", "center", "right"];

export interface IRegionScore {
  region: string;
  iou: number;
  onlyModel: number;
  onlyReference: number;
}

export interface ICompareResult {
  iou: number;
  both: number;
  onlyModel: number;
  onlyReference: number;
  regions: IRegionScore[];
  /** Regions with the lowest overlap first, only those that differ. */
  worst: IRegionScore[];
}

const iouOf = (both: number, a: number, b: number) => (both + a + b === 0 ? 1 : both / (both + a + b));

/** Compares two size×size masks overall and in a 3×3 grid. */
export function compareMasks(model: Uint8Array, reference: Uint8Array, size: number): ICompareResult {
  const cells = Array.from({ length: 9 }, () => ({ both: 0, m: 0, r: 0 }));
  let both = 0, onlyModel = 0, onlyReference = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, m = model[i], r = reference[i];
    const cell = cells[Math.min(2, Math.floor((y * 3) / size)) * 3 + Math.min(2, Math.floor((x * 3) / size))];
    if (m && r) { both++; cell.both++; } else if (m) { onlyModel++; cell.m++; } else if (r) { onlyReference++; cell.r++; }
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const regions = cells.map((c, i) => {
    const name = i === 4 ? "center" : `${ROWS[Math.floor(i / 3)]}-${COLS[i % 3]}`;
    return { region: name, iou: round(iouOf(c.both, c.m, c.r)), onlyModel: c.m, onlyReference: c.r };
  });
  const worst = regions.filter(r => r.onlyModel + r.onlyReference > 0).sort((a, b) => a.iou - b.iou);
  return { iou: round(iouOf(both, onlyModel, onlyReference)), both, onlyModel, onlyReference, regions, worst };
}

/** RGBA diff: grey where both, red where only the model, blue where only the reference, transparent elsewhere. */
export function diffImage(model: Uint8Array, reference: Uint8Array, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const m = model[i], r = reference[i];
    const px = m && r ? [170, 170, 170, 255] : m ? [230, 60, 60, 255] : r ? [60, 110, 230, 255] : [0, 0, 0, 0];
    out.set(px, i * 4);
  }
  return out;
}
