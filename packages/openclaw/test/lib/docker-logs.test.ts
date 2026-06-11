import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

class MockStream extends EventEmitter {
  setEncoding(_encoding: string): this {
    return this;
  }
}

class MockChildProcess extends EventEmitter {
  stdout = new MockStream();
  stderr = new MockStream();
  exitCode: number | null = null;
  killed = false;

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    this.exitCode = signal === "SIGKILL" ? 137 : 0;
    queueMicrotask(() => this.emit("close", this.exitCode, signal ?? null));
    return true;
  }
}

const childProcessMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: childProcessMocks.execFileSync,
  spawn: childProcessMocks.spawn,
}));

import {
  getContainerLogsSince,
  startLiveToolTrace,
  toolWasInvoked,
} from "./docker-logs.js";

describe("docker log helpers", () => {
  beforeEach(() => {
    childProcessMocks.execFileSync.mockReset();
    childProcessMocks.spawn.mockReset();
    vi.restoreAllMocks();
  });

  it("passes through docker compose log capture", () => {
    childProcessMocks.execFileSync.mockReturnValue("captured logs");

    const logs = getContainerLogsSince("dev/docker-compose.test.yml", "2026-01-01T00:00:00Z");

    expect(logs).toBe("captured logs");
    expect(childProcessMocks.execFileSync).toHaveBeenCalledWith(
      "docker",
      [
        "compose",
        "-f",
        "dev/docker-compose.test.yml",
        "logs",
        "--no-color",
        "--since",
        "2026-01-01T00:00:00Z",
        "openclaw",
      ],
      expect.objectContaining({ encoding: "utf-8", timeout: 10_000 }),
    );
  });

  it("matches only structured tool invocation logs", () => {
    const logs = [
      "ordinary log line mentioning read tool",
      "openclaw  | embedded run tool start: runId=1 tool=read toolCallId=abc",
      "openclaw  | embedded run tool end: runId=1 tool=web_search toolCallId=def",
    ].join("\n");

    expect(toolWasInvoked(logs, "read")).toBe(true);
    expect(toolWasInvoked(logs, "web_search")).toBe(true);
    expect(toolWasInvoked(logs, "write")).toBe(false);
  });

  it("streams structured tool lines live and returns them on stop", async () => {
    const child = new MockChildProcess();
    childProcessMocks.spawn.mockReturnValue(child);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const trace = startLiveToolTrace({
      composeFile: "dev/docker-compose.test.yml",
      sinceIso: "2026-01-01T00:00:00Z",
      label: "correlated [ref-deadbeef]",
    });

    child.stdout.emit(
      "data",
      [
        "openclaw  | boot log line",
        "openclaw  | embedded run tool start: runId=1 tool=read toolCallId=abc",
      ].join("\n") + "\n",
    );
    child.stderr.emit(
      "data",
      [
        "openclaw  | embedded run tool end: runId=1 tool=read toolCallId=abc",
        'openclaw  | info: [tlon] tooltrace after: {"phase":"after","toolName":"read","payload":{"result":{"ok":true}}}',
      ].join("\n") + "\n",
    );
    child.stdout.emit(
      "data",
      "openclaw  | embedded run tool start: runId=2 tool=web_search toolCallId=def",
    );

    const lines = await trace.stop();

    expect(lines).toEqual([
      "embedded start read abc",
      "embedded end read abc",
      'after read {"result":{"ok":true}}',
      "embedded start web_search def",
    ]);
    expect(logSpy).toHaveBeenCalledWith(
      "[tooltrace correlated [ref-deadbeef]] embedded start read abc",
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[tooltrace correlated [ref-deadbeef]] embedded end read abc",
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[tooltrace correlated [ref-deadbeef]] after read {"result":{"ok":true}}',
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[tooltrace correlated [ref-deadbeef]] embedded start web_search def",
    );
  });
});
