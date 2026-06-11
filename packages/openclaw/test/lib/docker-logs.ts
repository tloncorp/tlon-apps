/**
 * Docker Container Log Capture
 *
 * Captures OpenClaw container logs for asserting tool invocations
 * in integration tests run under docker compose (pnpm test:integration).
 */

import { execFileSync, spawn } from "node:child_process";

type LiveToolTraceOptions = {
  composeFile: string;
  sinceIso: string;
  label?: string;
};

export type LiveToolTraceHandle = {
  stop(): Promise<string[]>;
  getLines(): string[];
};

const TOOL_TRACE_LINE_RE = /(?:embedded run tool (?:start|end):|tooltrace (?:before|after):)/;

/**
 * Capture openclaw container logs since a given timestamp.
 *
 * @param composeFile - Path to docker-compose file (from TEST_COMPOSE_FILE)
 * @param sinceIso - ISO 8601 timestamp to filter logs from
 * @returns Raw log text
 * @throws If docker compose command fails (propagates to test as assertion failure)
 */
export function getContainerLogsSince(
  composeFile: string,
  sinceIso: string,
): string {
  const output = execFileSync(
    "docker",
    ["compose", "-f", composeFile, "logs", "--no-color", "--since", sinceIso, "openclaw"],
    { encoding: "utf-8", timeout: 10_000, cwd: process.cwd() },
  );
  return output;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stringifyCompact(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractToolTraceLine(rawLine: string): string | null {
  const line = rawLine.trim();
  if (!TOOL_TRACE_LINE_RE.test(line)) {
    return null;
  }

  const embeddedIndex = line.indexOf("embedded run tool ");
  if (embeddedIndex >= 0) {
    const embedded = line.slice(embeddedIndex);
    const match = embedded.match(
      /^embedded run tool (start|end):.*\btool=([^\s]+)\b(?:.*\btoolCallId=([^\s]+)\b)?/,
    );
    if (!match) {
      return embedded;
    }
    const [, phase, toolName, toolCallId] = match;
    return toolCallId
      ? `embedded ${phase} ${toolName} ${toolCallId}`
      : `embedded ${phase} ${toolName}`;
  }

  const tooltraceIndex = line.indexOf("tooltrace ");
  if (tooltraceIndex >= 0) {
    const tooltrace = line.slice(tooltraceIndex);
    const match = tooltrace.match(/^tooltrace (before|after):\s*(\{.*\})$/);
    if (!match) {
      return tooltrace;
    }

    const [, phase, json] = match;
    try {
      const parsed = JSON.parse(json) as {
        toolName?: string;
        payload?: unknown;
      };
      const toolName = parsed.toolName ?? "unknown";
      return `${phase} ${toolName} ${stringifyCompact(parsed.payload ?? {})}`;
    } catch {
      return tooltrace;
    }
  }

  return line;
}

function logLiveToolTrace(label: string | undefined, line: string): void {
  const prefix = label ? `[tooltrace ${label}]` : "[tooltrace]";
  console.log(`${prefix} ${line}`);
}

function recordTraceLine(lines: string[], label: string | undefined, line: string | null): void {
  if (!line) {
    return;
  }
  lines.push(line);
  logLiveToolTrace(label, line);
}

/**
 * Start streaming only structured tool-execution lines from the openclaw
 * docker container logs. Intended for live CI debugging around a single prompt.
 */
export function startLiveToolTrace(
  options: LiveToolTraceOptions,
): LiveToolTraceHandle {
  const child = spawn(
    "docker",
    [
      "compose",
      "-f",
      options.composeFile,
      "logs",
      "--no-color",
      "--since",
      options.sinceIso,
      "-f",
      "openclaw",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const lines: string[] = [];
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let stopPromise: Promise<string[]> | null = null;

  const handleChunk = (chunk: string, kind: "stdout" | "stderr") => {
    const existing = kind === "stdout" ? stdoutBuffer : stderrBuffer;
    const combined = existing + chunk;
    const parts = combined.split(/\r?\n/);
    const remainder = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line) {
        continue;
      }
      const traceLine = extractToolTraceLine(line);
      if (!traceLine) {
        continue;
      }
      recordTraceLine(lines, options.label, traceLine);
    }

    if (kind === "stdout") {
      stdoutBuffer = remainder;
    } else {
      stderrBuffer = remainder;
    }
  };

  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk: string) => handleChunk(chunk, "stdout"));

  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk: string) => handleChunk(chunk, "stderr"));

  child.on("error", (err) => {
    console.warn(`[tooltrace] failed to stream docker logs: ${err}`);
  });

  return {
    stop(): Promise<string[]> {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = new Promise<string[]>((resolve) => {
        const finalize = () => {
          recordTraceLine(lines, options.label, extractToolTraceLine(stdoutBuffer));
          recordTraceLine(lines, options.label, extractToolTraceLine(stderrBuffer));
          stdoutBuffer = "";
          stderrBuffer = "";
          resolve([...lines]);
        };

        if (child.exitCode !== null || child.killed) {
          finalize();
          return;
        }

        child.once("close", finalize);

        try {
          child.kill("SIGTERM");
        } catch {
          finalize();
          return;
        }

        setTimeout(() => {
          if (child.exitCode === null && !child.killed) {
            try {
              child.kill("SIGKILL");
            } catch {
              // Ignore cleanup race.
            }
          }
        }, 2_000).unref();
      });

      return stopPromise;
    },
    getLines(): string[] {
      return [...lines];
    },
  };
}

/**
 * Check whether a specific tool was invoked in the container logs.
 *
 * Matches only the structured OpenClaw tool execution log lines:
 *   "embedded run tool start: runId=... tool=<name> toolCallId=..."
 *   "embedded run tool end: runId=... tool=<name> toolCallId=..."
 *
 * Does NOT match general log lines that happen to mention a tool name
 * (e.g., logged prompt text, diagnostic messages).
 */
export function toolWasInvoked(logs: string, toolName: string): boolean {
  const escaped = escapeRegex(toolName);
  // Match only the structured "embedded run tool start/end" log format.
  // The key distinguisher is "embedded run tool" prefix + " tool=<name>" field.
  return new RegExp(
    `embedded run tool (?:start|end):.*\\btool=${escaped}\\b`,
  ).test(logs);
}
