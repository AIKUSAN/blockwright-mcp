/**
 * Overlap and z-fighting finder for (possibly rotated) cubes.
 *
 * A cube is an oriented box: centre, three unit axes and half sizes, in world
 * space. Z-fighting is two faces of different cubes that lie in the same plane,
 * face the same way and overlap by a real area. Interpenetration is found with
 * the separating-axis test. Pure logic; runs under `node --test`.
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
export type V3 = [number, number, number];

export interface IBox {
  name: string;
  center: V3;
  axes: [V3, V3, V3];
  half: V3;
  valid: boolean;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** Rotation matrix columns for Euler degrees in three.js order "ZYX" (Blockbench cubes): R = Rz·Ry·Rx. */
function rotationColumns(deg: number[]): [V3, V3, V3] {
  const [x, y, z] = deg.map(d => (d * Math.PI) / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  // Rows of Rz·Ry·Rx
  const m = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  return [0, 1, 2].map(c => [m[0][c], m[1][c], m[2][c]] as V3) as [V3, V3, V3];
}

/**
 * Box from Blockbench cube data (absolute from/to, inflate, rotation about
 * origin). Parent group rotations are not applied here; inside Blockbench the
 * caller uses boxFromMatrix with the mesh's world matrix instead.
 */
export function boxFromCube(c: { name: string; from: number[]; to: number[]; inflate?: number; rotation?: number[]; origin?: number[] }): IBox {
  const inflate = c.inflate ?? 0;
  const origin = (c.origin ?? [0, 0, 0]) as V3;
  const rot = c.rotation ?? [0, 0, 0];
  const nums = [...c.from, ...c.to, inflate, ...origin, ...rot];
  const valid = nums.length === 13 && nums.every(Number.isFinite);
  const half = [0, 1, 2].map(i => Math.abs(c.to[i] - c.from[i]) / 2 + inflate) as V3;
  const localCenter = sub([0, 1, 2].map(i => (c.from[i] + c.to[i]) / 2) as V3, origin);
  const axes = rotationColumns(rot);
  const center = add(origin, add(add(mul(axes[0], localCenter[0]), mul(axes[1], localCenter[1])), mul(axes[2], localCenter[2])));
  return { name: c.name, center, axes, half, valid: valid && half.every(h => h >= 0) };
}

/** Box from a local centre and half sizes, placed by a column-major 4×4 world matrix (three.js `matrixWorld.elements`). */
export function boxFromMatrix(name: string, localCenter: V3, half: V3, m: number[]): IBox {
  const col = (i: number): V3 => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
  const raw = [col(0), col(1), col(2)];
  const scales = raw.map(len);
  const axes = raw.map((a, i) => mul(a, 1 / (scales[i] || 1))) as [V3, V3, V3];
  const center = add(col(3), add(add(mul(raw[0], localCenter[0]), mul(raw[1], localCenter[1])), mul(raw[2], localCenter[2])));
  const valid = m.length === 16 && m.every(Number.isFinite) && [...localCenter, ...half].every(Number.isFinite) && scales.every(s => s > 0);
  return { name, center, axes, half: half.map((h, i) => h * scales[i]) as V3, valid };
}

interface IFace { normal: V3; point: V3; u: V3; v: V3; hu: number; hv: number; axis: number; sign: 1 | -1 }

function faces(b: IBox): IFace[] {
  const out: IFace[] = [];
  for (let i = 0; i < 3; i++) for (const sign of [1, -1] as const) {
    const normal = mul(b.axes[i], sign);
    const j = (i + 1) % 3, k = (i + 2) % 3;
    out.push({ normal, point: add(b.center, mul(normal, b.half[i])), u: b.axes[j], v: b.axes[k], hu: b.half[j], hv: b.half[k], axis: i, sign });
  }
  return out;
}

type P2 = [number, number];
const area2 = (poly: P2[]) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** Sutherland–Hodgman clip of a convex polygon by a convex counter-clockwise polygon. */
function clip(subject: P2[], clipper: P2[]): P2[] {
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const inside = (p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-12;
    const hit = (p: P2, q: P2): P2 => {
      const [x1, y1, x2, y2, x3, y3, x4, y4] = [p[0], p[1], q[0], q[1], a[0], a[1], b[0], b[1]];
      const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    const input = out; out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k], prev = input[(k + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(hit(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(hit(prev, cur));
    }
  }
  return out;
}

function faceCorners(f: IFace): V3[] {
  const [u, v] = [mul(f.u, f.hu), mul(f.v, f.hv)];
  return [add(add(f.point, u), v), add(sub(f.point, u), v), sub(sub(f.point, u), v), sub(add(f.point, u), v)];
}

function overlapArea(fa: IFace, fb: IFace): number {
  const to2 = (p: V3): P2 => { const d = sub(p, fa.point); return [dot(d, fa.u), dot(d, fa.v)]; };
  const ccw = (poly: P2[]) => (area2(poly) < 0 ? [...poly].reverse() : poly);
  const a = ccw(faceCorners(fa).map(to2)), b = ccw(faceCorners(fb).map(to2));
  const inter = clip(b, a);
  return inter.length >= 3 ? Math.abs(area2(inter)) : 0;
}

/** Penetration depth by the separating-axis test; 0 when separated or only touching. */
function penetration(a: IBox, b: IBox): number {
  const axes: V3[] = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) { const c = cross(x, y); if (len(c) > 1e-6) axes.push(mul(c, 1 / len(c))); }
  const d = sub(b.center, a.center);
  let depth = Infinity;
  for (const L of axes) {
    const ra = a.half.reduce((s, h, i) => s + h * Math.abs(dot(a.axes[i], L)), 0);
    const rb = b.half.reduce((s, h, i) => s + h * Math.abs(dot(b.axes[i], L)), 0);
    const overlap = ra + rb - Math.abs(dot(d, L));
    if (overlap <= 1e-6) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}

export interface IZFight {
  a: string;
  b: string;
  /** Shared outward normal of the coplanar faces, in world space. */
  normal: V3;
  area: number;
  suggestion: { cube: string; offset: V3; note: string };
}

export interface IOverlapReport {
  checked: number;
  skipped: number;
  zFighting: IZFight[];
  volumeOverlaps: { a: string; b: string; depth: number }[];
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Finds z-fighting face pairs and interpenetrating cubes. `nudge` is the suggested outward offset. */
export function findOverlaps(boxes: IBox[], options: { planeEpsilon?: number; minArea?: number; nudge?: number } = {}): IOverlapReport {
  const eps = options.planeEpsilon ?? 1e-3;
  const minArea = options.minArea ?? 1e-4;
  const nudge = options.nudge ?? 0.01;
  const valid = boxes.filter(b => b.valid);
  const report: IOverlapReport = { checked: valid.length, skipped: boxes.length - valid.length, zFighting: [], volumeOverlaps: [] };
  const radius = (b: IBox) => len(b.half);
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const A = valid[i], B = valid[j];
    if (len(sub(A.center, B.center)) > radius(A) + radius(B) + eps) continue;
    for (const fa of faces(A)) for (const fb of faces(B)) {
      if (dot(fa.normal, fb.normal) < 1 - 1e-6) continue;
      if (Math.abs(dot(fa.normal, sub(fb.point, fa.point))) > eps) continue;
      const area = overlapArea(fa, fb);
      if (area < minArea) continue;
      const smaller = fa.hu * fa.hv <= fb.hu * fb.hv ? A : B;
      report.zFighting.push({
        a: A.name, b: B.name, normal: fa.normal.map(round) as V3, area: round(area),
        suggestion: {
          cube: smaller.name,
          offset: mul(fa.normal, nudge).map(round) as V3,
          note: `Move "${smaller.name}" by ${nudge} outward (or inflate it by ${nudge / 2}) so its face sits in front of "${smaller === A ? B.name : A.name}".`,
        },
      });
    }
    const depth = penetration(A, B);
    if (depth > 1e-4) report.volumeOverlaps.push({ a: A.name, b: B.name, depth: round(depth) });
  }
  return report;
}
