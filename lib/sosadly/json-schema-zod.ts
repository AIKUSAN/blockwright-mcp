/**
 * Converts the JSON Schema subset used by sosadly's tool catalogue into zod,
 * so those tools register through the base plugin's createTool. Supported:
 * object (properties, required), string, number, integer, boolean, array
 * (items, minItems, maxItems), enum, oneOf/anyOf, minimum/maximum, default,
 * description. Anything else becomes z.any() with its description kept.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 */
import { z } from "zod";

type JsonSchema = Record<string, any>;

function describe<T extends z.ZodTypeAny>(schema: T, spec: JsonSchema): T {
  return (typeof spec.description === "string" ? schema.describe(spec.description) : schema) as T;
}

export function jsonSchemaToZod(spec: JsonSchema | undefined): z.ZodTypeAny {
  if (!spec || typeof spec !== "object") return z.any();
  if (Array.isArray(spec.enum) && spec.enum.length > 0) {
    const values = spec.enum;
    const schema = values.every((v: unknown) => typeof v === "string")
      ? z.enum(values as [string, ...string[]])
      : z.union(values.map((v: unknown) => z.literal(v as never)) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    return describe(values.length === 1 && !values.every((v: unknown) => typeof v === "string") ? z.literal(values[0]) : schema, spec);
  }
  const branches = spec.oneOf ?? spec.anyOf;
  if (Array.isArray(branches) && branches.length > 0) {
    const parts = branches.map((b: JsonSchema) => jsonSchemaToZod(b));
    return describe(parts.length === 1 ? parts[0] : z.union(parts as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]), spec);
  }
  switch (spec.type) {
    case "string":
      return describe(z.string(), spec);
    case "number":
    case "integer": {
      let schema = spec.type === "integer" ? z.number().int() : z.number();
      if (typeof spec.minimum === "number") schema = schema.min(spec.minimum);
      if (typeof spec.maximum === "number") schema = schema.max(spec.maximum);
      return describe(schema, spec);
    }
    case "boolean":
      return describe(z.boolean(), spec);
    case "array": {
      let schema = z.array(jsonSchemaToZod(spec.items));
      if (typeof spec.minItems === "number") schema = schema.min(spec.minItems);
      if (typeof spec.maxItems === "number") schema = schema.max(spec.maxItems);
      return describe(schema, spec);
    }
    case "object":
      return describe(objectSchema(spec), spec);
    default:
      return describe(z.any(), spec);
  }
}

/** A top-level tool input: an object whose optional fields stay optional and unknown keys pass through. */
export function objectSchema(spec: JsonSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const required = new Set<string>(Array.isArray(spec.required) ? spec.required : []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, child] of Object.entries((spec.properties ?? {}) as Record<string, JsonSchema>)) {
    const converted = jsonSchemaToZod(child);
    shape[key] = required.has(key) ? converted : converted.optional();
  }
  return z.object(shape).passthrough();
}
