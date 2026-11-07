/**
 * In-process replacement for sosadly/blockbench-mcp's HTTP client: the
 * vendored catalogue (lib/sosadly/catalogue.ts) calls callBlockbench, which
 * now runs the command directly instead of posting to 127.0.0.1:8787.
 *
 * Copyright (c) 2026 AIKUSAN. Part of an unofficial fork of
 * jasonjgardner/blockbench-mcp-plugin, distributed under GPL-3.0-only.
 */
type Dispatch = (action: string, params: Record<string, unknown>) => Promise<unknown>;

let dispatcher: Dispatch | undefined;

export function setDispatcher(next: Dispatch | undefined): void {
  dispatcher = next;
}

export async function callBlockbench(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (!dispatcher) throw new Error("The sosadly command core is not loaded.");
  return dispatcher(action, params);
}
