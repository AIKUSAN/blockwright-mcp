/**
 * Repro for the 1.0.1 hang report: opens MCP sessions without DELETE against the
 * plugin's real HTTP server (server/net.ts), flips ~2/3 of the tools on as
 * create_project would, and measures memory and latency. Uses synthetic tools
 * and fake Blockbench globals, so it runs under Bun without Blockbench.
 *
 *   bun run tests/repro/session-buildup.ts [sessions...]       (default 1 5 20 32 40)
 *   bun run tests/repro/session-buildup.ts --streams [toggles] [streams...]  (unread GET streams)
 *   bun run tests/repro/session-buildup.ts --live <url> <n> [project]  (a running Blockbench)
 *
 * Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
 */
import net, { type AddressInfo } from "node:net";
import { z } from "zod";

const HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const TIMEOUT_MS = 15_000;

interface IReply { status: number; sessionId: string | null; body: string; ms: number }

async function post(url: string, body: unknown, sessionId?: string | null): Promise<IReply> {
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { ...HEADERS, ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  return { status: response.status, sessionId: response.headers.get("mcp-session-id"), body: text, ms: performance.now() - started };
}

/** initialize + notifications/initialized + tools/list, like each client run in the hang report. Never sends DELETE. */
async function openSession(url: string, n: number): Promise<{ id: string; tools: number; ms: number }> {
  const init = await post(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: `repro-${n}`, version: "0" } } });
  if (init.status !== 200 || !init.sessionId) throw new Error(`initialize ${n}: HTTP ${init.status} ${init.body.slice(0, 200)}`);
  await post(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sessionId);
  const list = await post(url, { jsonrpc: "2.0", id: 2, method: "tools/list" }, init.sessionId);
  return { id: init.sessionId, tools: JSON.parse(list.body).result?.tools?.length ?? -1, ms: init.ms };
}

async function call(url: string, sessionId: string, name: string): Promise<IReply> {
  return post(url, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: {} } }, sessionId);
}

async function remove(url: string, sessionId: string): Promise<number> {
  const response = await fetch(url, { method: "DELETE", headers: { "Mcp-Session-Id": sessionId }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  await response.text();
  return response.status;
}

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** Starts the real HTTP server with 204 synthetic tools; `project` flips the 135 project-only ones. */
async function startHarness() {
  let hasProject = false;
  Object.assign(globalThis, {
    Blockbench: { showQuickMessage: () => {} },
    Condition: (condition: unknown) => typeof condition === "function" ? Boolean((condition as () => boolean)()) : Boolean(condition),
  });
  const { createTool } = await import("@/lib/factories");
  const { sessionManager } = await import("@/lib/sessions");
  const createNetServer = (await import("@/server/net")).default;

  // 204 tools: 69 always on, 135 that need a project (as in 1.0.1 with every setting on).
  const parameters = z.object({
    id: z.string().optional().describe("Element id or name."),
    position: z.array(z.number()).length(3).optional().describe("Position in block units."),
    size: z.array(z.number()).length(3).optional().describe("Size in block units."),
    color: z.string().optional().describe("Hex colour."),
    mode: z.enum(["a", "b", "c"]).optional().describe("Mode."),
  });
  for (let i = 0; i < 204; i++) {
    createTool(i === 0 ? "get_status" : `tool_${i}`, {
      description: `Synthetic tool ${i} with a schema about the size of a real one.`,
      parameters,
      condition: i < 69 ? undefined : () => hasProject,
      execute: async () => JSON.stringify({ has_project: hasProject }),
    });
  }

  const [servers] = createNetServer(net, { port: 0, endpoint: "/blockwright", keepAlive: { enabled: false, idleTimeoutMs: 0, sseHeartbeatIntervalMs: 0 } });
  await new Promise<void>((resolve) => servers[0].listening ? resolve() : servers[0].once("listening", () => resolve()));
  const url = `http://127.0.0.1:${(servers[0].address() as AddressInfo).port}/blockwright`;

  return { url, servers, sessionManager, setProject: (on: boolean) => { hasProject = on; } };
}

async function harness(counts: number[]): Promise<void> {
  const { url, servers, sessionManager, setProject } = await startHarness();
  console.log("sessions | rss MB | heap MB | init ms (last) | tools before/after project | get_status ms | open after");
  for (const count of counts) {
    setProject(false);
    Bun.gc(true);
    const heap0 = process.memoryUsage().heapUsed;
    const opened = [];
    for (let n = 0; n < count; n++) opened.push(await openSession(url, n));
    setProject(true); // create_project
    const after = await post(url, { jsonrpc: "2.0", id: 9, method: "tools/list" }, opened.at(-1)!.id);
    const fresh = await openSession(url, count); // the run that hung: a new session, then get_status
    const status = await call(url, fresh.id, "get_status");
    Bun.gc(true);
    const mem = process.memoryUsage();
    console.log(`${String(count).padStart(8)} | ${String(mb(mem.rss)).padStart(6)} | ${String(mb(mem.heapUsed - heap0)).padStart(7)} | ${opened.at(-1)!.ms.toFixed(1).padStart(14)} | ${opened[0].tools}/${JSON.parse(after.body).result?.tools?.length ?? "?"} | ${status.status} ${status.ms.toFixed(1)} | ${sessionManager.getCount()}`);
    for (const id of [...opened.map((s) => s.id), fresh.id]) if (sessionManager.has(id)) await remove(url, id);
  }
  for (const server of servers) server.close();
  sessionManager.clear();
}

/**
 * Clients that open the GET notification stream and never read it (or read it late),
 * and never DELETE. Flips the project-only tools `toggles` times, each flip followed by
 * a probe request (every request re-checks tool availability), then measures.
 */
async function streams(counts: number[], toggles: number): Promise<void> {
  const { url, servers, sessionManager, setProject } = await startHarness();
  const { port, pathname } = new URL(url);
  console.log(`toggles per run: ${toggles}`);
  console.log("streams | opened/refused | rss MB | heap MB | get_status ms (before/after) | list_changed per stream (min-max) | bytes per stream | open after");
  for (const count of counts) {
    setProject(false);
    Bun.gc(true);
    const heap0 = process.memoryUsage().heapUsed;
    const clients: { id: string; socket: net.Socket; received: () => string }[] = [];
    let refused = 0;
    for (let n = 0; n < count; n++) {
      let id: string;
      try {
        id = (await openSession(url, n)).id;
      } catch {
        refused++;
        continue;
      }
      let data = "";
      const socket = net.connect({ host: "127.0.0.1", port: Number(port) });
      await new Promise<void>((resolve) => socket.once("connect", () => resolve()));
      socket.write(`GET ${pathname} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAccept: text/event-stream\r\nMcp-Session-Id: ${id}\r\n\r\n`);
      await new Promise<void>((resolve) => socket.once("data", (chunk) => { data += chunk.toString(); resolve(); }));
      socket.pause(); // never read from here on, until the measurement
      socket.on("data", (chunk) => { data += chunk.toString(); });
      clients.push({ id, socket, received: () => data });
    }
    const fresh = await openSession(url, count + 1).catch(() => null);
    // At the session limit no new client gets in; an open stream session then sends the requests.
    const probe = fresh ?? (clients[0] ? { id: clients[0].id } : null);
    const before = probe ? await call(url, probe.id, "get_status") : null;
    for (let t = 0; t < toggles; t++) {
      setProject(t % 2 === 0);
      if (probe) await post(url, { jsonrpc: "2.0", id: 10 + t, method: "tools/list" }, probe.id);
      await Bun.sleep(0); // let the SDK's debounced notification go out
    }
    const after = probe ? await call(url, probe.id, "get_status") : null;
    Bun.gc(true);
    const mem = process.memoryUsage();
    for (const client of clients) client.socket.resume();
    await Bun.sleep(300);
    const counts = clients.map((c) => (c.received().match(/notifications\/tools\/list_changed/g) ?? []).length);
    const bytes = clients.map((c) => c.received().length);
    const range = (v: number[]) => v.length ? `${Math.min(...v)}-${Math.max(...v)}` : "-";
    console.log(`${String(count).padStart(7)} | ${clients.length}/${refused} | ${String(mb(mem.rss)).padStart(6)} | ${String(mb(mem.heapUsed - heap0)).padStart(7)} | ${fresh ? "" : "(in a stream session) "}${before ? `${before.status} ${before.ms.toFixed(1)}` : "no probe"} / ${after ? `${after.status} ${after.ms.toFixed(1)}` : "-"} | ${range(counts)} | ${range(bytes)} | ${sessionManager.getCount()}`);
    for (const client of clients) client.socket.destroy();
    for (const id of [...clients.map((c) => c.id), ...(fresh ? [fresh.id] : [])]) if (sessionManager.has(id)) await remove(url, id);
    await Bun.sleep(50);
  }
  for (const server of servers) server.close();
  sessionManager.clear();
}

/**
 * Replays the hang report's order on a running Blockbench: a session that creates a
 * scratch project, then more sessions that only list tools, none closed, then a new
 * session's get_status. Stops at the first request that times out. Every session it
 * opened is closed with DELETE at the end if the server still answers.
 */
async function live(url: string, count: number, projectName: string): Promise<void> {
  const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);
  log(`live: ${count} sessions without DELETE against ${url}`);
  const opened: string[] = [];
  try {
    for (let n = 0; n < count; n++) {
      const session = await openSession(url, n);
      opened.push(session.id);
      log(`session ${n}: init ${session.ms.toFixed(0)} ms, ${session.tools} tools`);
      if (n === 0) {
        const created = await post(url, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "create_project", arguments: { name: projectName, format: "bedrock" } } }, session.id);
        log(`session 0 create_project: HTTP ${created.status} in ${created.ms.toFixed(0)} ms: ${created.body.slice(0, 120)}`);
        await Bun.sleep(1500);
      }
    }
    const fresh = await openSession(url, count);
    opened.push(fresh.id);
    const status = await call(url, fresh.id, "get_status");
    log(`new session get_status: HTTP ${status.status} in ${status.ms.toFixed(0)} ms: ${status.body.slice(0, 160)}`);
    await Bun.sleep(35_000); // past one 30 s ping round with every session still open
    const again = await call(url, fresh.id, "get_status");
    log(`get_status after 35 s: HTTP ${again.status} in ${again.ms.toFixed(0)} ms`);
  } catch (error) {
    log(`STOPPED: ${String(error)}`);
    return;
  }
  for (const id of opened) log(`DELETE ${id.slice(0, 8)}: ${await remove(url, id)}`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--live") await live(args[1], Number(args[2] ?? 5), args[3] ?? "bw_repro_scratch");
  else if (args[0] === "--streams") await streams(args.slice(2).length ? args.slice(2).map(Number) : [1, 5, 40], Number(args[1] ?? 6));
  else await harness(args.length ? args.map(Number) : [1, 5, 20, 32, 40]);
  process.exit(0);
}
