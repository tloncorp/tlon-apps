import { describe, expect, it } from "vitest";
import {
  _testing,
  formatToolTraceEvent,
  liveToolTraceContentsEnabled,
  shouldLogAfterToolTrace,
} from "./tool-trace.js";

describe("tool trace helpers", () => {
  it("detects env-gated content tracing", () => {
    expect(liveToolTraceContentsEnabled({ TEST_LIVE_TOOL_TRACE_CONTENTS: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(liveToolTraceContentsEnabled({ CI_LIVE_TOOL_TRACE_CONTENTS: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(liveToolTraceContentsEnabled({ TEST_LIVE_TOOL_TRACE_CONTENTS: "0" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("redacts sensitive keys and truncates long strings", () => {
    const event = formatToolTraceEvent({
      phase: "after",
      sessionKey: "session-123",
      toolName: "read",
      payload: {
        token: "secret-token",
        nested: {
          password: "hunter2",
          text: "x".repeat(350),
        },
      },
    });

    expect(event).toContain('"toolName":"read"');
    expect(event).toContain('"token":"[REDACTED]"');
    expect(event).toContain('"password":"[REDACTED]"');
    expect(event).toContain('[350 chars]');
    expect(event).not.toContain("secret-token");
    expect(event).not.toContain("hunter2");
  });

  it("collapses deep and oversized structures", () => {
    const sanitized = _testing.sanitizeValue({
      items: Array.from({ length: 25 }, (_, i) => i),
      deep: { a: { b: { c: { d: { e: true } } } } },
    });

    expect(sanitized).toEqual({
      items: [...Array.from({ length: 20 }, (_, i) => i), "[+5 more items]"],
      deep: { a: { b: { c: "[Object keys=1]" } } },
    });
  });

  it("suppresses incomplete duplicate after events", () => {
    expect(
      shouldLogAfterToolTrace({
        result: { ok: true },
        durationMs: undefined,
        error: undefined,
      }),
    ).toBe(false);

    expect(
      shouldLogAfterToolTrace({
        result: { ok: true },
        durationMs: 123,
        error: undefined,
      }),
    ).toBe(true);

    expect(
      shouldLogAfterToolTrace({
        result: undefined,
        durationMs: undefined,
        error: "boom",
      }),
    ).toBe(true);
  });
});
