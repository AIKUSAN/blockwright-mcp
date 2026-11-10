// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
// Wiring checks for the sosadly tools added in Blockwright 1.1.0 (sosadly 0.4.0, b024728, MIT).
// Their behaviour is tested against lib/sosadly/core.js in tests-node/sosadly/.
import { afterEach, describe, expect, test } from "bun:test";
import { tools as catalogue } from "@/lib/sosadly/catalogue";
import { setDispatcher } from "@/lib/sosadly/client";
import { sosadlyToolDocs } from "@/server/tools/sosadly";

/** New in sosadly 0.4.0. */
const NEW_IN_040 = [
  "add_cylinder", "add_flare", "add_gear", "add_hair", "add_meshes", "add_pipe", "animate_mechanism",
  "create_textures", "fix_z_fighting", "get_palette", "inspect_model", "make_palette", "paint_face", "zoom_reference",
];
/** Registered since 1.1.0 under sosadly's own name (the name does not clash with a base tool). */
const UNMERGED = [
  "add_cube", "add_cubes", "add_keyframe", "add_keyframes", "add_mesh", "delete_element",
  "execute_script", "list_outliner", "new_project", "screenshot",
];

type Schema = { type?: string; items?: Schema; minItems?: number; enum?: unknown[]; oneOf?: Schema[]; properties?: Record<string, Schema>; required?: string[] };

/** A value that satisfies the JSON schema fragment, for the required arguments. */
function sample(schema: Schema): unknown {
  if (schema.enum) return schema.enum[0];
  if (schema.oneOf) return sample(schema.oneOf[0]);
  switch (schema.type) {
    case "number": return 1;
    case "boolean": return true;
    case "array": return Array.from({ length: schema.minItems ?? 0 }, () => sample(schema.items ?? {}));
    case "object": return {};
    default: return "x";
  }
}
function requiredArgs(tool: { inputSchema: Record<string, unknown> }): Record<string, unknown> {
  const schema = tool.inputSchema as Schema;
  return Object.fromEntries((schema.required ?? []).map(key => [key, sample(schema.properties?.[key] ?? {})]));
}

afterEach(() => setDispatcher(undefined));

describe("sosadly tools added in 1.1.0", () => {
  for (const name of [...NEW_IN_040, ...UNMERGED]) {
    describe(name, () => {
      const spec = sosadlyToolDocs.find(t => t.name === name);
      const tool = catalogue.find(t => t.name === name);

      test("is registered, described and experimental", () => {
        expect(spec).toBeDefined();
        expect(tool).toBeDefined();
        expect(spec!.description.length).toBeGreaterThan(20);
        expect(spec!.status).toBe("experimental");
      });

      test("its parameters accept the required arguments", () => {
        const parsed = spec!.parameters.safeParse(requiredArgs(tool!));
        expect(parsed.success).toBe(true);
      });

      test("its handler sends the command to the Blockbench core by its own name", async () => {
        const seen: Array<[string, Record<string, unknown>]> = [];
        setDispatcher(async (action, params) => { seen.push([action, params]); return {}; });
        await tool!.handler(requiredArgs(tool!));
        expect(seen.length).toBeGreaterThanOrEqual(1);
        expect(seen[0][0]).toBe(name);
      });
    });
  }

  test("find_references (web image search) is not ported", () => {
    expect(catalogue.some(t => t.name === "find_references")).toBe(false);
    expect(sosadlyToolDocs.some(t => t.name === "find_references")).toBe(false);
  });

  test("load_reference takes a path or image data only: no web download", () => {
    const properties = (catalogue.find(t => t.name === "load_reference")!.inputSchema as Schema).properties!;
    expect(Object.keys(properties).sort()).toEqual(["data_url", "name", "opacity", "overlay", "path"]);
  });

  test("no tool description sends the model to find_references", () => {
    for (const tool of catalogue) expect(tool.description, tool.name).not.toContain("find_references");
    expect(catalogue.find(t => t.name === "get_status")!.description).toContain("Blockwright has no web image search");
  });

  test("no argument description offers a load_reference option that was removed", () => {
    for (const tool of catalogue) expect(JSON.stringify(tool.inputSchema), tool.name).not.toMatch(/find_references|load_reference \{result/);
  });
});
