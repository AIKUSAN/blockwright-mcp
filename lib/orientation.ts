/**
 * Model orientation and view labelling. Pure math, no Blockbench globals, so it
 * runs under `node --test` as well as inside the plugin.
 *
 * Adapted from sosadly/blockbench-mcp (`plugin/blockbench_mcp.js`, commit
 * 028cdd7: `facingAxis`, `orientation`, `sideOfCoord`, `viewOffsetDir`,
 * `describeView`), used under the MIT License:
 *
 *     Copyright (c) 2026 sosadly
 *
 *     Permission is hereby granted, free of charge, to any person obtaining a
 *     copy of this software and associated documentation files (the
 *     "Software"), to deal in the Software without restriction, including
 *     without limitation the rights to use, copy, modify, merge, publish,
 *     distribute, sublicense, and/or sell copies of the Software, and to
 *     permit persons to whom the Software is furnished to do so, subject to
 *     the following conditions:
 *
 *     The above copyright notice and this permission notice shall be included
 *     in all copies or substantial portions of the Software.
 *
 *     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 *     OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *     MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *     IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *     CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *     TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *     SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Changes by AIKUSAN, 2026-11-06 (this file as a whole is distributed under
 * GPL-3.0-only as part of this fork):
 * - rewritten as typed, dependency-free functions;
 * - the screen's right edge is computed the way three.js `lookAt` builds its
 *   camera basis (world up kept, x = up × (eye − target)). The upstream code
 *   swapped "up" for the model's front on top and bottom views, which puts the
 *   model's right on the wrong edge of a top view.
 */

export type Vec3 = [number, number, number];
export type AxisName = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export const AXIS_VECTORS: Record<AxisName, Vec3> = {
  "+x": [1, 0, 0], "-x": [-1, 0, 0],
  "+y": [0, 1, 0], "-y": [0, -1, 0],
  "+z": [0, 0, 1], "-z": [0, 0, -1],
};

export const WORLD_UP: Vec3 = [0, 1, 0];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len === 0) throw new Error("Cannot normalize a zero vector.");
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function axisLabel(v: Vec3): AxisName | null {
  for (const [name, axis] of Object.entries(AXIS_VECTORS) as [AxisName, Vec3][]) {
    if (dot(v, axis) > 0.999) return name;
  }
  return null;
}

export interface IOrientation {
  facing: AxisName;
  front: Vec3;
  back: Vec3;
  right: Vec3;
  left: Vec3;
  up: Vec3;
  rightAxis: AxisName;
  leftAxis: AxisName;
}

/**
 * The model's own axes. Minecraft-style models face −Z (north) unless the
 * format says otherwise (`Format.forward_direction`), so the model's RIGHT is
 * +X in Blockbench space: right = forward × up.
 */
export function orientation(forwardDirection?: string | null): IOrientation {
  const facing: AxisName = forwardDirection && forwardDirection in AXIS_VECTORS
    ? forwardDirection as AxisName
    : "-z";
  const front = AXIS_VECTORS[facing];
  const right = cross(front, WORLD_UP);
  const left = scale(right, -1);
  const rightAxis = axisLabel(right);
  const leftAxis = axisLabel(left);
  if (!rightAxis || !leftAxis) throw new Error(`Facing ${facing} has no horizontal right axis.`);
  return { facing, front, back: scale(front, -1), right, left, up: WORLD_UP, rightAxis, leftAxis };
}

/** Which side of the model a coordinate along the side axis falls on. Dead zone ±eps counts as centre. */
export function sideOfCoord(point: Vec3, o: IOrientation, eps = 0.35): "right" | "left" | "center" {
  const d = dot(point, o.right);
  if (d > eps) return "right";
  if (d < -eps) return "left";
  return "center";
}

export const REVIEW_VIEW_NAMES = [
  "front", "back", "right", "left", "top", "bottom",
  "front_right", "front_left", "back_right", "back_left",
] as const;
export type ReviewViewName = typeof REVIEW_VIEW_NAMES[number];

/**
 * Unit vector from the model's centre towards the camera, named in the model's
 * own frame ("right" = the camera stands on the model's right side). Top and
 * bottom are nudged towards the front so `lookAt` never degenerates.
 */
export function viewDirection(name: ReviewViewName, o: IOrientation): Vec3 {
  const nudge = scale(o.front, 0.001);
  const iso = (a: Vec3, b: Vec3): Vec3 => normalize(add(add(a, b), scale(o.up, 0.85)));
  switch (name) {
    case "front": return o.front;
    case "back": return o.back;
    case "right": return o.right;
    case "left": return o.left;
    case "top": return normalize(add(o.up, nudge));
    case "bottom": return normalize(add(scale(o.up, -1), nudge));
    case "front_right": return iso(o.front, o.right);
    case "front_left": return iso(o.front, o.left);
    case "back_right": return iso(o.back, o.right);
    case "back_left": return iso(o.back, o.left);
  }
}

/**
 * The image's right-hand direction in world space for a camera at `eye`
 * looking at `target`, built like three.js `Matrix4.lookAt`: z = eye − target,
 * x = up × z. Inside Blockbench prefer the real camera matrix (column 0 of
 * `camera.matrixWorld`); this is the fallback and the tested reference.
 */
export function screenRightFor(eye: Vec3, target: Vec3, cameraUp: Vec3 = WORLD_UP): Vec3 {
  return normalize(cross(cameraUp, normalize(sub(eye, target))));
}

export type EdgeSide = "image_left" | "image_right" | "edge_on";

export interface IViewLabel {
  /** Which edge of the image shows the model's own right side. */
  modelRightOn: EdgeSide;
  /** Text for the image's left and right edges, e.g. "model's RIGHT". */
  leftEdge: string;
  rightEdge: string;
  /** True when the viewer faces the model, so its right appears on their left. */
  mirrored: boolean;
}

/** Labels a view from the image's right-hand world direction. */
export function labelView(screenRight: Vec3, viewDir: Vec3, o: IOrientation): IViewLabel {
  const d = dot(normalize(screenRight), o.right);
  const modelRightOn: EdgeSide = d > 0.2 ? "image_right" : d < -0.2 ? "image_left" : "edge_on";
  const mirrored = dot(viewDir, o.front) > 0.5;
  if (modelRightOn === "edge_on") {
    const facingCamera = dot(viewDir, o.right) > 0 ? "RIGHT" : "LEFT";
    return { modelRightOn, leftEdge: `model's ${facingCamera} side faces you`, rightEdge: "", mirrored: false };
  }
  const onLeft = modelRightOn === "image_left";
  return {
    modelRightOn,
    leftEdge: onLeft ? "model's RIGHT" : "model's LEFT",
    rightEdge: onLeft ? "model's LEFT" : "model's RIGHT",
    mirrored,
  };
}
