// Modified by AIKUSAN, 2026-11-06: setting ids and defaults follow the fork identity.
import { beforeEach, describe, expect, test } from "bun:test";
import { useGlobals } from "@/tests/helpers/globals";
import { settingsSetup, settingsTeardown } from "@/ui/settings";

/** Minimal double for Blockbench's `Setting`; records deletion instead of touching a dialog. */
class TestSetting {
  static all = new Map<string, TestSetting>();
  master_value: unknown;
  deleted = false;

  constructor(readonly id: string, data: { value: unknown }) {
    this.master_value = data.value;
    TestSetting.all.set(id, this);
  }

  delete(): void {
    this.deleted = true;
    TestSetting.all.delete(this.id);
  }
}

let stored: Record<string, { value: unknown }>;

beforeEach(() => {
  stored = {};
  TestSetting.all.clear();
});

useGlobals(() => ({
  Setting: TestSetting,
  Settings: { stored },
  tl: (key: string) => key,
}));

function portSetting(): TestSetting {
  const setting = TestSetting.all.get("blockwright_port");
  if (!setting) throw new Error("blockwright_port setting was not registered");
  return setting;
}

describe("settingsTeardown", () => {
  test("with keepValues writes the current values to Settings.stored and keeps the settings registered", () => {
    settingsSetup();
    const registered = [...TestSetting.all.values()];
    portSetting().master_value = 3010;

    settingsTeardown({ keepValues: true });

    expect(stored.blockwright_port).toEqual({ value: 3010 });
    expect(stored.blockwright_endpoint).toEqual({ value: "/blockwright" });
    expect(Object.keys(stored).sort()).toEqual(registered.map((setting) => setting.id).sort());
    expect(registered.every((setting) => !setting.deleted)).toBe(true);
    expect(TestSetting.all.size).toBe(registered.length);
  });

  test("without keepValues deletes every setting and stores nothing", () => {
    settingsSetup();
    const registered = [...TestSetting.all.values()];
    portSetting().master_value = 3010;

    settingsTeardown();

    expect(registered.every((setting) => setting.deleted)).toBe(true);
    expect(TestSetting.all.size).toBe(0);
    expect(stored).toEqual({});
  });

  test("uninstall (onunload keeping values, then onuninstall) deletes the settings and their stored values", () => {
    settingsSetup();
    const registered = [...TestSetting.all.values()];
    settingsTeardown({ keepValues: true });

    settingsTeardown();

    expect(registered.every((setting) => setting.deleted)).toBe(true);
    expect(TestSetting.all.size).toBe(0);
    expect(stored).toEqual({});
  });

  test("a reload does not leave stale settings that a later uninstall would delete by id", () => {
    settingsSetup();
    const stale = [...TestSetting.all.values()];
    settingsTeardown({ keepValues: true });
    settingsSetup();
    const current = [...TestSetting.all.values()];

    settingsTeardown();

    expect(stale.every((setting) => !setting.deleted)).toBe(true);
    expect(current.every((setting) => setting.deleted)).toBe(true);
    expect(TestSetting.all.size).toBe(0);
  });
});
