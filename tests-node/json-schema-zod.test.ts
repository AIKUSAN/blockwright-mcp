// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonSchemaToZod, objectSchema } from "../lib/sosadly/json-schema-zod.ts";

const vec3 = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };
const tool = objectSchema({
  type: "object",
  properties: {
    name: { type: "string", description: "Element name" },
    from: vec3,
    side: { type: "string", enum: ["left", "right", "center"] },
    samples: { type: "integer", minimum: 4, maximum: 48 },
    views: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
    loop: { type: "boolean" },
  },
  required: ["name"],
});

test("required and optional fields", () => {
  assert.equal(tool.safeParse({ name: "arm_right" }).success, true);
  assert.equal(tool.safeParse({}).success, false);
});

test("arrays keep their length bounds, enums their values, integers their range", () => {
  assert.equal(tool.safeParse({ name: "a", from: [1, 2, 3] }).success, true);
  assert.equal(tool.safeParse({ name: "a", from: [1, 2] }).success, false);
  assert.equal(tool.safeParse({ name: "a", side: "up" }).success, false);
  assert.equal(tool.safeParse({ name: "a", samples: 4.5 }).success, false);
  assert.equal(tool.safeParse({ name: "a", samples: 100 }).success, false);
});

test("oneOf accepts each branch", () => {
  assert.equal(tool.safeParse({ name: "a", views: "front" }).success, true);
  assert.equal(tool.safeParse({ name: "a", views: ["front", "back"] }).success, true);
  assert.equal(tool.safeParse({ name: "a", views: 3 }).success, false);
});

test("unknown keys pass through; descriptions survive; unknown types become any", () => {
  const parsed = tool.parse({ name: "a", extra: 1 });
  assert.equal((parsed as Record<string, unknown>).extra, 1);
  assert.equal(tool.shape.name.description, "Element name");
  assert.equal(jsonSchemaToZod({ type: "mystery" }).safeParse({ x: 1 }).success, true);
  assert.equal(jsonSchemaToZod(undefined).safeParse(5).success, true);
});
