// Copyright (c) 2026 AIKUSAN. GPL-3.0-only (Blockwright MCP).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "..", "bin", "install-skills.sh");
const bundled = readdirSync(join(import.meta.dir, "..", "skills"), { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(import.meta.dir, "..", "skills", e.name, "SKILL.md")))
  .map(e => e.name)
  .sort();
let dest: string;

function run(...args: string[]) {
  const result = Bun.spawnSync(["bash", script, "--dest", dest, ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}
const listing = () => readdirSync(dest).filter(n => n !== "_old").sort();

beforeEach(() => { dest = join(mkdtempSync(join(tmpdir(), "bw-skills-")), "skills"); });
afterEach(() => { rmSync(join(dest, ".."), { recursive: true, force: true }); });

describe("bin/install-skills.sh", () => {
  test("bundles the 16 upstream skills", () => {
    expect(bundled.length).toBe(16);
    expect(bundled).toContain("blockbench-mcp-modeling");
    expect(bundled).toContain("blockbench-use");
  });

  test("copies every skill folder, and nothing else", () => {
    const { code, out } = run();
    expect(code).toBe(0);
    expect(listing()).toEqual(bundled);
    expect(existsSync(join(dest, "README.md"))).toBe(false);
    expect(existsSync(join(dest, "blockbench-use", "SKILL.md"))).toBe(true);
    expect(existsSync(join(dest, "blockbench-use", "UPSTREAM.md"))).toBe(true);
    expect(out).toContain(`installed (${bundled.length})`);
  });

  test("a second run skips and names every folder that is already there", () => {
    run();
    writeFileSync(join(dest, "blockbench-use", "SKILL.md"), "my edit");
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).toContain(`skipped, already there (${bundled.length})`);
    expect(out).toContain("blockbench-use");
    expect(readFileSync(join(dest, "blockbench-use", "SKILL.md"), "utf8")).toBe("my edit");
    expect(existsSync(join(dest, "_old"))).toBe(false);
  });

  test("--update moves the old copy to _old/<name>_<date>/ and installs the new one", () => {
    run();
    writeFileSync(join(dest, "blockbench-use", "SKILL.md"), "my edit");
    const { code, out } = run("--update");
    expect(code).toBe(0);
    expect(out).toContain(`updated (${bundled.length})`);
    const olds = readdirSync(join(dest, "_old")).filter(n => n.startsWith("blockbench-use_"));
    expect(olds.length).toBe(1);
    expect(olds[0]).toMatch(/^blockbench-use_\d{4}-\d{2}-\d{2}$/);
    expect(readFileSync(join(dest, "_old", olds[0], "SKILL.md"), "utf8")).toBe("my edit");
    expect(readFileSync(join(dest, "blockbench-use", "SKILL.md"), "utf8")).not.toBe("my edit");
  });

  test("--update twice in a day never overwrites an earlier _old copy", () => {
    run();
    writeFileSync(join(dest, "blockbench-use", "SKILL.md"), "first");
    run("--update");
    writeFileSync(join(dest, "blockbench-use", "SKILL.md"), "second");
    run("--update");
    const olds = readdirSync(join(dest, "_old")).filter(n => n.startsWith("blockbench-use_")).sort();
    expect(olds.length).toBe(2);
    const contents = olds.map(n => readFileSync(join(dest, "_old", n, "SKILL.md"), "utf8")).sort();
    expect(contents).toEqual(["first", "second"]);
  });

  test("--update leaves a skill the bundle does not ship alone", () => {
    mkdirSync(join(dest, "my-own-skill"), { recursive: true });
    writeFileSync(join(dest, "my-own-skill", "SKILL.md"), "mine");
    run("--update");
    expect(readFileSync(join(dest, "my-own-skill", "SKILL.md"), "utf8")).toBe("mine");
  });

  test("--dry-run changes nothing", () => {
    const { code, out } = run("--dry-run");
    expect(code).toBe(0);
    expect(out).toContain("would:");
    expect(existsSync(dest)).toBe(false);
  });

  test("an unknown option fails with a message", () => {
    const { code, err } = run("--wipe");
    expect(code).toBe(2);
    expect(err).toContain("unknown option");
  });
});
