/// <reference types="three" />
/// <reference types="blockbench-types" />
/**
 * Registers the tools ported from sosadly/blockbench-mcp (MIT, Copyright (c)
 * 2026 sosadly; see lib/sosadly/catalogue.ts and lib/sosadly/core.js for the
 * notice). Tools that duplicate a base tool are not registered; the base tool
 * is kept (SOSADLY_MERGED_INTO). install_plugin and uninstall_plugin stay
 * disabled until the setting blockwright_plugin_management_enabled is turned on.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 */
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTool, refreshToolAvailability, type IToolSpec } from "@/lib/factories";
import { DEFAULT_MCP_PORT, STATUS_EXPERIMENTAL } from "@/lib/constants";
import {
  canCreateOffscreenView, createOffscreenView, getOffscreenViewCount, listViews, rememberOffscreenCamera,
  renderViewToDataUrl, resizeOffscreenView, resolveView,
} from "@/lib/views";
import { tools as sosadlyCatalogue, coerceArgs } from "@/lib/sosadly/catalogue";
import { setDispatcher } from "@/lib/sosadly/client";
import { objectSchema } from "@/lib/sosadly/json-schema-zod";
// @ts-ignore - vendored plain JavaScript, typed by lib/sosadly/core.d.ts
import { createSosadlyCore } from "@/lib/sosadly/core.js";

/** sosadly tool → the base tool that replaces it. These sosadly tools are not registered. */
export const SOSADLY_MERGED_INTO: Readonly<Record<string, string>> = {
  add_group: "add_group",
  apply_texture: "apply_texture",
  create_animation: "create_animation",
  create_texture: "create_texture",
  export_model: "export_model",
  get_texture: "get_texture",
  list_textures: "list_textures",
  set_camera_angle: "set_camera_angle",
  set_cube_uv: "set_cube_uv",
  new_project: "create_project",
  delete_element: "remove_element",
  list_outliner: "list_outline",
  screenshot: "capture_screenshot",
  execute_script: "risky_eval",
  add_cube: "place_cube",
  add_cubes: "place_cube",
  add_keyframe: "manage_keyframes",
  add_keyframes: "batch_keyframe_operations",
  add_mesh: "place_mesh / create_sphere / create_cylinder / create_polyhedron",
};

export const SETTING_PLUGIN_MANAGEMENT = "blockwright_plugin_management_enabled";
const PLUGIN_MANAGEMENT_TOOLS = new Set(["install_plugin", "uninstall_plugin"]);
const CAPTURE_VIEW_ID = "sosadly_capture";
const DEFAULT_CAPTURE_SIZE = 768;

type Core = {
  commands: Record<string, (params: Record<string, unknown>) => unknown>;
  dispatch(action: string, params: Record<string, unknown>): Promise<unknown>;
  buildPanel(): void;
  teardown(): void;
};
let core: Core | undefined;
let managementSetting: { delete(): void } | undefined;

/**
 * Every sosadly capture goes through one plugin-owned offscreen view, made on
 * first use and kept (one WebGL context), so the user's camera never moves.
 */
function capturePreview(): Preview {
  if (!listViews().some(v => v.id === CAPTURE_VIEW_ID)) {
    if (!canCreateOffscreenView()) {
      throw new Error(`No offscreen view slot is free (${getOffscreenViewCount()} in use); delete one with delete_offscreen_view first.`);
    }
    createOffscreenView({ id: CAPTURE_VIEW_ID, width: DEFAULT_CAPTURE_SIZE, height: DEFAULT_CAPTURE_SIZE, antialias: true, copyFrom: "none" });
  }
  return resolveView(CAPTURE_VIEW_ID);
}

function shoot(preview: Preview, options?: { width?: number; height?: number }): string {
  const width = Math.round(options?.width || DEFAULT_CAPTURE_SIZE);
  const height = Math.round(options?.height || options?.width || DEFAULT_CAPTURE_SIZE);
  if (preview.width !== width || preview.height !== height) {
    // Keep the camera sosadly just placed across the resize.
    rememberOffscreenCamera(preview);
    resizeOffscreenView(CAPTURE_VIEW_ID, width, height);
  }
  rememberOffscreenCamera(preview);
  return renderViewToDataUrl(preview);
}

function getCore(): Core {
  if (!core) {
    core = createSosadlyCore({
      capturePreview,
      shoot,
      // @ts-ignore - requireNativeModule is a Blockbench global
      fs: () => requireNativeModule("fs"),
      port: () => {
        const value = Number(Settings.get("blockwright_port"));
        return Number.isInteger(value) && value > 0 ? value : DEFAULT_MCP_PORT;
      },
    }) as Core;
    setDispatcher((action, params) => core!.dispatch(action, params));
  }
  return core;
}

/** Called from the plugin's onload: the Copilot panel and the plugin-management toggle. */
export function setupSosadly(): void {
  getCore().buildPanel();
  managementSetting = new Setting(SETTING_PLUGIN_MANAGEMENT, {
    name: "Blockwright MCP: allow install_plugin / uninstall_plugin",
    description: "Lets AI agents install and remove Blockbench plugins. Off by default.",
    type: "toggle",
    value: false,
    category: "general",
    onChange: () => refreshToolAvailability(),
  });
}

export function teardownSosadly(): void {
  managementSetting?.delete();
  managementSetting = undefined;
  core?.teardown();
  core = undefined;
  setDispatcher(undefined);
}

const pluginManagementEnabled = () => Settings.get(SETTING_PLUGIN_MANAGEMENT) === true;

export const sosadlyToolDocs: IToolSpec[] = sosadlyCatalogue
  .filter(tool => !(tool.name in SOSADLY_MERGED_INTO))
  .map(tool => {
    const shape = objectSchema(tool.inputSchema as Record<string, unknown>);
    return {
      name: tool.name,
      description: tool.description,
      annotations: { title: tool.name.replace(/_/g, " ") },
      // Normalise loose input the way sosadly did (JSON text, comma lists, numeric strings) before validating.
      parameters: z.preprocess(value => coerceArgs(tool.inputSchema, (value ?? {}) as Record<string, unknown>), shape),
      status: STATUS_EXPERIMENTAL,
      ...(PLUGIN_MANAGEMENT_TOOLS.has(tool.name) ? { condition: pluginManagementEnabled } : {}),
    } satisfies IToolSpec;
  });

export function registerSosadlyTools() {
  const handlers = new Map(sosadlyCatalogue.map(tool => [tool.name, tool.handler]));
  for (const spec of sosadlyToolDocs) {
    const handler = handlers.get(spec.name)!;
    createTool(spec.name, {
      ...spec,
      async execute(args: Record<string, unknown>): Promise<CallToolResult> {
        getCore();
        return { content: await handler(args) } as CallToolResult;
      },
    }, spec.status);
  }
}
