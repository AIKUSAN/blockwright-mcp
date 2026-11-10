// Loads lib/sosadly/core.js as a plain script for the behaviour tests copied from sosadly.
//
// sosadly's tests run the plugin file in a vm context with stubbed Blockbench globals and read
// its `commands` table through a registration anchor. Blockwright's core is a function module
// (createSosadlyCore), so this turns it back into that shape: `export` is dropped, the factory
// is called with test hooks, and the factory's closing `return { commands, ... }` is spelled as
// the anchor `Plugin.register(PLUGIN_ID, {` the tests instrument.
//
// Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(here, "..", "..", "lib", "sosadly", "core.js"), "utf8");

const FACTORY = "export function createSosadlyCore(hooks) {";
const TAIL_OPEN = "return {\n\tcommands,\n\tdispatch,";
if (!raw.includes(FACTORY)) throw new Error("core.js no longer exports createSosadlyCore: update tests-node/sosadly/core-as-script.mjs");
if (raw.split(TAIL_OPEN).length !== 2) throw new Error("core.js factory return changed: update tests-node/sosadly/core-as-script.mjs");

// Rebuild with the closing brace spelled as the end of a call, then run the factory.
const transformed = raw.replace(FACTORY, "function createSosadlyCore(hooks) {").replace(TAIL_OPEN, "Plugin.register(PLUGIN_ID, {\n\tcommands,\n\tdispatch,");
const close = transformed.lastIndexOf("};\n}");
export const source = transformed.slice(0, close) + "});\n}\ncreateSosadlyCore(__HOOKS__);\n" + transformed.slice(close + "};\n}".length);

/** Hooks the core expects from the plugin: captures, files, the port and the eval switch. */
export const HOOKS = {
  capturePreview: () => ({ width: 64, height: 64, render() {}, camera: {} }),
  shoot: () => "data:image/png;base64,iVBORw0KGgo=",
  fs: () => fs,
  port: () => 3001,
  scriptsAllowed: () => true,
};
