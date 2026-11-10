/**
 * Behaviour tests for the sosadly tools that sosadly's own tests do not cover (inspect_model,
 * animate_mechanism, zoom_reference, paint_face, get_palette, execute_script, delete_element,
 * add_keyframe(s), new_project, screenshot), run against lib/sosadly/core.js with stubbed
 * Blockbench globals, in the style of the sosadly tests they sit beside.
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { source, HOOKS } from "./core-as-script.mjs";

const REGISTER = "Plugin.register(PLUGIN_ID, {";
assert.ok(source.includes(REGISTER), "core registration anchor moved: update core-as-script.mjs");
const instrumented = source.replace(REGISTER, "globalThis.__MCP_COMMANDS__ = commands;\n" + REGISTER);

/** A fresh, empty Blockbench-ish world plus the core's command table. */
function load({ overrides = {}, hooks = {} } = {}) {
  let seq = 0;
  const uuid = (p) => `${p}-${++seq}`;
  const undo = [];

  class Group {
    static all = [];
    constructor(data = {}) {
      this.name = data.name || "group";
      this.origin = (data.origin || [0, 0, 0]).slice();
      this.rotation = [0, 0, 0];
      this.children = [];
      this.uuid = uuid("g");
    }
    init() { Group.all.push(this); return this; }
    addTo() { return this; }
    remove() { Group.all = Group.all.filter((g) => g !== this); Group.all.length = Group.all.length; }
  }
  class Cube {
    static all = [];
    constructor(data = {}) {
      this.name = data.name || "cube";
      this.from = (data.from || [0, 0, 0]).slice();
      this.to = (data.to || [1, 1, 1]).slice();
      this.origin = this.from.slice();
      this.rotation = [0, 0, 0];
      this.inflate = 0;
      this.faces = { north: {}, south: {}, east: {}, west: {}, up: {}, down: {} };
      this.uuid = uuid("c");
    }
    init() { Cube.all.push(this); return this; }
    addTo() { return this; }
    remove() { Cube.all.splice(Cube.all.indexOf(this), 1); }
  }

  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Buffer,
    isApp: true,
    Plugin: { register() {} },
    Blockbench: { version: "5.2.2", showQuickMessage() {} },
    Project: { name: "test", geometry_name: "test", texture_width: 64, texture_height: 64 },
    Format: { id: "free", box_uv: false, animation_mode: true },
    Formats: {},
    Mode: { selected: { id: "edit" } },
    Texture: Object.assign([], { all: [], getDefault: () => null }),
    Animation: { all: [] },
    Undo: { initEdit(o) { undo.push(["init", o]); }, finishEdit(name) { undo.push(["finish", name]); } },
    Canvas: { updateAll() {} },
    Group, Cube,
    ...overrides,
  };
  sandbox.Outliner = { root: [], get elements() { return Cube.all; } };
  sandbox.globalThis = sandbox;
  sandbox.__HOOKS__ = { ...HOOKS, ...hooks };
  vm.createContext(sandbox);
  vm.runInContext(instrumented, sandbox, { filename: "sosadly-core.js" });
  return { commands: sandbox.__MCP_COMMANDS__, Cube, Group, sandbox, undo };
}

const plain = (v) => JSON.parse(JSON.stringify(v));

// --- execute_script follows the eval switch -------------------------------------------------
test("execute_script runs the code when the eval switch is on and returns its value", async () => {
  const { commands } = load();
  assert.equal(await commands.execute_script({ code: "return params.n * 2;", params: { n: 21 } }), 42);
});

test("execute_script refuses to run when the eval switch is off", () => {
  const { commands } = load({ hooks: { scriptsAllowed: () => false } });
  assert.throws(() => commands.execute_script({ code: "return 1;" }), /disabled/);
});

test("execute_script asks for code", () => {
  const { commands } = load();
  assert.throws(() => commands.execute_script({}), /code is required/);
});

// --- delete_element --------------------------------------------------------------------------
test("delete_element removes the element inside one Undo step", () => {
  const { commands, Cube, undo } = load();
  new Cube({ name: "keep" }).init();
  new Cube({ name: "drop" }).init();
  assert.deepEqual(plain(commands.delete_element({ element: "drop" })), { deleted: true });
  assert.deepEqual(Cube.all.map((c) => c.name), ["keep"]);
  assert.deepEqual(undo.map((u) => u[0]), ["init", "finish"]);
});

test("delete_element names the element it cannot find and changes nothing", () => {
  const { commands, Cube, undo } = load();
  new Cube({ name: "only" }).init();
  assert.throws(() => commands.delete_element({ element: "ghost" }), /Element not found: ghost/);
  assert.equal(Cube.all.length, 1);
  assert.equal(undo.length, 0);
});

// --- new_project -----------------------------------------------------------------------------
test("new_project refuses an unknown format and names the way to list them", () => {
  const { commands } = load({ overrides: { newProject: () => true } });
  assert.throws(() => commands.new_project({ format: "nope" }), /Unknown format "nope".*list_formats/s);
});

test("new_project creates the project in the resolved format and applies name and texture size", () => {
  const made = [];
  const project = { name: "old", geometry_name: "old", texture_width: 16, texture_height: 16 };
  const { commands, sandbox } = load({
    overrides: {
      Formats: { free: { id: "free", name: "Generic Model" } },
      Project: project,
      newProject: (fmt) => { made.push(fmt.id); return true; },
    },
  });
  commands.get_status = commands.get_status || (() => ({ project: {} }));
  commands.new_project({ format: "free", name: "fox", texture_width: 32, texture_height: 48 });
  assert.deepEqual(made, ["free"]);
  assert.equal(sandbox.Project.name, "fox");
  assert.equal(sandbox.Project.geometry_name, "fox");
  assert.equal(sandbox.Project.texture_width, 32);
  assert.equal(sandbox.Project.texture_height, 48);
});

// --- get_palette -----------------------------------------------------------------------------
test("get_palette reports an empty palette, then the one make_palette stored", async () => {
  const { commands } = load();
  const empty = plain(commands.get_palette());
  assert.equal(empty.count, 0);
  assert.equal(empty.card_data_url, null);
  assert.deepEqual(empty.palette, []);
  await commands.make_palette({ source: "text", colors: { hair: "#5a6fd0" } });
  const stored = plain(commands.get_palette());
  assert.equal(stored.count, 1);
  assert.equal(stored.palette[0].key, "hair");
  assert.equal(stored.palette[0].ramp.length, 5);
});

// --- paint_face ------------------------------------------------------------------------------
test("paint_face names the cube it cannot find", () => {
  const { commands } = load();
  assert.throws(() => commands.paint_face({ cube: "head" }), /Cube not found: "head"/);
});

test("paint_face asks for a texture before painting a face", () => {
  const { commands, Cube } = load();
  new Cube({ name: "head", from: [0, 0, 0], to: [8, 8, 8] }).init();
  assert.throws(() => commands.paint_face({ cube: "head" }), /No texture\. Run pack_uv, create_texture and detail_cubes/);
});

// --- zoom_reference --------------------------------------------------------------------------
test("zoom_reference says so when no reference is loaded", async () => {
  const { commands } = load();
  await assert.rejects(async () => commands.zoom_reference({ rect: [0, 0, 0.5, 0.5] }), /No reference loaded/);
});

// --- inspect_model ---------------------------------------------------------------------------
test("inspect_model refuses an empty model", async () => {
  const { commands } = load();
  await assert.rejects(async () => commands.inspect_model({}), /The model has no cubes yet/);
});

// --- add_keyframe and add_keyframes ----------------------------------------------------------
function animatedWorld() {
  const keyframes = [];
  const animator = { addKeyframe(k) { const kf = { uuid: `k${keyframes.length + 1}`, ...k }; keyframes.push(kf); return kf; } };
  const anim = {
    uuid: "a-1", name: "walk", length: 1, selected: false,
    select() { this.selected = true; },
    setLength(n) { this.length = n; },
    getBoneAnimator: () => animator,
  };
  const world = load({ overrides: { Animation: { all: [anim] }, updateKeyframeSelection() {} } });
  new world.Group({ name: "leg" }).init();
  return { ...world, anim, keyframes };
}

test("add_keyframe writes one keyframe on a bone and stretches the animation to fit", () => {
  const { commands, anim, keyframes, undo } = animatedWorld();
  const result = plain(commands.add_keyframe({ animation: "walk", bone: "leg", time: 2.5, value: [10, 0, 0] }));
  assert.equal(keyframes.length, 1);
  assert.deepEqual(plain(keyframes[0].data_points), [{ x: 10, y: 0, z: 0 }]);
  assert.equal(keyframes[0].channel, "rotation");
  assert.equal(anim.length, 2.5);
  assert.equal(result.channel, "rotation");
  assert.deepEqual(undo.map((u) => u[0]), ["init", "finish"]);
});

test("add_keyframe names a missing animation or bone before writing anything", () => {
  const { commands, keyframes } = animatedWorld();
  assert.throws(() => commands.add_keyframe({ animation: "run", bone: "leg" }), /Animation not found: run/);
  assert.throws(() => commands.add_keyframe({ animation: "walk", bone: "tail" }), /Bone \(group\) not found: tail/);
  assert.equal(keyframes.length, 0);
});

test("add_keyframes checks every bone first, so a typo leaves no half animation", () => {
  const { commands, keyframes } = animatedWorld();
  assert.throws(
    () => commands.add_keyframes({ animation: "walk", keyframes: [{ bone: "leg", time: 0, value: [0, 0, 0] }, { bone: "wing", time: 1, value: [5, 0, 0] }] }),
    /Bone \(group\) not found: wing/,
  );
  assert.equal(keyframes.length, 0);
});

// --- animate_mechanism -----------------------------------------------------------------------
test("animate_mechanism wants parts, a positive length and a driver that is listed", () => {
  const { commands } = animatedWorld();
  assert.throws(() => commands.animate_mechanism({}), /parts \(array\) is required/);
  assert.throws(() => commands.animate_mechanism({ parts: [{ bone: "a", type: "spin" }], length: 0 }), /length must be greater than 0/);
  assert.throws(() => commands.animate_mechanism({ parts: [{ bone: "b", driven_by: "a" }] }), /driven_by "a" must also be listed in parts/);
  assert.throws(() => commands.animate_mechanism({ parts: [{ type: "spin" }] }), /every part needs a `bone`/);
});

test("animate_mechanism refuses a driver loop", () => {
  const { commands } = animatedWorld();
  assert.throws(
    () => commands.animate_mechanism({ parts: [{ bone: "a", driven_by: "b" }, { bone: "b", driven_by: "a" }] }),
    /loop/,
  );
});

// --- screenshot ------------------------------------------------------------------------------
test("screenshot captures through the plugin's offscreen hook and stamps the way the model faces", async () => {
  const shots = [];
  const preview = { width: 64, height: 64, camera: { position: { x: 0, y: 8, z: -40 } }, render() {} };
  const { commands, Cube } = load({
    hooks: { capturePreview: () => preview, shoot: (p, opts) => { shots.push(opts); return "data:image/png;base64,AAAA"; } },
  });
  new Cube({ name: "body", from: [-4, 0, -2], to: [4, 12, 2] }).init();
  const result = plain(await commands.screenshot({ annotate: false, width: 128 }));
  assert.equal(result.mime, "image/png");
  assert.equal(result.base64, "AAAA");
  assert.deepEqual(plain(shots), [{ width: 128 }]);
  assert.equal(typeof result.view, "string");
});
