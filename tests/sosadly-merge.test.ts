// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (unofficial fork of jasonjgardner/blockbench-mcp-plugin).
import { describe, expect, test } from "bun:test";
import { tools as catalogue } from "@/lib/sosadly/catalogue";
import { SOSADLY_MERGED_INTO, sosadlyToolDocs } from "@/server/tools/sosadly";
import docs from "@/docs/api.json";

const baseNames = new Set<string>();
JSON.stringify(docs, (key, value) => {
  if (value && typeof value === "object" && typeof value.name === "string" && "description" in value) baseNames.add(value.name);
  return value;
});

describe("sosadly merge", () => {
  test("every sosadly tool is either registered or merged into a base tool", () => {
    const registered = new Set(sosadlyToolDocs.map(t => t.name));
    for (const tool of catalogue) {
      expect(registered.has(tool.name) !== (tool.name in SOSADLY_MERGED_INTO)).toBe(true);
    }
    // sosadly 0.4.0 (b024728) has 86 tools; find_references (web image search) is not ported.
    expect(catalogue.length).toBe(85);
    expect(registered.size).toBe(85 - Object.keys(SOSADLY_MERGED_INTO).length);
    expect(registered.size).toBe(76);
  });

  test("no registered sosadly tool reuses a base tool name", () => {
    for (const spec of sosadlyToolDocs) expect(baseNames.has(spec.name)).toBe(false);
  });

  test("every merge target names a base tool", () => {
    for (const target of Object.values(SOSADLY_MERGED_INTO)) {
      for (const name of target.split(" / ")) expect(baseNames.has(name)).toBe(true);
    }
  });

  test("only same-named clashes are merged; differently named twins are registered", () => {
    expect(Object.keys(SOSADLY_MERGED_INTO).sort()).toEqual(Object.values(SOSADLY_MERGED_INTO).sort());
    for (const name of ["add_cube", "add_cubes", "add_mesh", "delete_element", "list_outliner", "new_project", "screenshot", "execute_script", "add_keyframe", "add_keyframes"]) {
      expect(sosadlyToolDocs.some(t => t.name === name)).toBe(true);
    }
  });

  test("execute_script follows the risky_eval switch and install tools are gated", () => {
    expect(sosadlyToolDocs.find(t => t.name === "execute_script")?.condition).toBeFunction();
  });

  test("plugin install tools are registered but gated", () => {
    for (const name of ["install_plugin", "uninstall_plugin"]) {
      expect(sosadlyToolDocs.find(t => t.name === name)?.condition).toBeFunction();
    }
  });

  test("lenient input: a numeric string is coerced before validation", () => {
    const spec = sosadlyToolDocs.find(t => t.name === "analyze_animation")!;
    const parsed = spec.parameters.safeParse({ animation: "walk", samples: "8" });
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { samples: unknown } }).data.samples).toBe(8);
  });
});
