// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orientation, sideOfCoord, viewDirection, screenRightFor, labelView, scale, type Vec3,
} from "../lib/orientation.ts";

const o = orientation();
const at = (name: Parameters<typeof viewDirection>[0]) => {
  const dir = viewDirection(name, o);
  const eye = scale(dir, 40) as Vec3;
  return labelView(screenRightFor(eye, [0, 0, 0]), dir, o);
};

test("default model faces -Z with its right on +X", () => {
  assert.equal(o.facing, "-z");
  assert.equal(o.rightAxis, "+x");
  assert.equal(o.leftAxis, "-x");
});

test("format forward_direction overrides the default", () => {
  const south = orientation("+z");
  assert.equal(south.rightAxis, "-x");
  assert.equal(orientation("bogus").facing, "-z");
});

test("side of a point: +X is right, -X left, dead zone is centre", () => {
  assert.equal(sideOfCoord([5, 0, 0], o), "right");
  assert.equal(sideOfCoord([-5, 0, 0], o), "left");
  assert.equal(sideOfCoord([0.2, 9, 3], o), "center");
});

test("front view is mirrored: model's right on the image's left", () => {
  const label = at("front");
  assert.equal(label.modelRightOn, "image_left");
  assert.equal(label.leftEdge, "model's RIGHT");
  assert.equal(label.mirrored, true);
});

test("back view: model's right on the image's right", () => {
  const label = at("back");
  assert.equal(label.modelRightOn, "image_right");
  assert.equal(label.mirrored, false);
});

test("side views are edge-on and name the side facing the camera", () => {
  assert.equal(at("right").modelRightOn, "edge_on");
  assert.match(at("right").leftEdge, /RIGHT side faces you/);
  assert.match(at("left").leftEdge, /LEFT side faces you/);
});

test("top view follows three.js lookAt (world up kept): model's right on image LEFT", () => {
  // sosadly's describeView swapped "up" for the model's front here and
  // reported image_right. three.js Matrix4.lookAt keeps camera.up = +Y, so
  // with the camera nudged towards the front, the image's right is -X.
  assert.equal(at("top").modelRightOn, "image_left");
});

test("front_right iso: model's right on the image's left, mirrored", () => {
  const label = at("front_right");
  assert.equal(label.modelRightOn, "image_left");
  assert.equal(label.mirrored, true);
});
