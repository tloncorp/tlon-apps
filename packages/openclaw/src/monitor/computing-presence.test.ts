import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
} = vi.hoisted(() => ({
  createComputingStatus: vi.fn(({ thinking, toolCalls }) => ({
    thinking,
    toolCalls,
  })),
  getComputingStatusText: vi.fn(() => "Computing"),
  serializeComputingStatus: vi.fn(({ thinking, toolCalls }) => ({
    thinking,
    toolCalls,
  })),
  setConversationPresence: vi.fn(async () => {}),
}));

vi.mock("@tloncorp/api", () => ({
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
}));

import {
  createComputingPresenceReporter,
  createComputingPresenceTracker,
} from "./computing-presence.js";

describe("createComputingPresenceTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("publishes presence with an empty disclose array", async () => {
    const reporter = createComputingPresenceReporter();

    await reporter.publish({
      conversationId: "~nec",
      thinking: true,
      toolNames: ["exec"],
    });

    expect(setConversationPresence).toHaveBeenCalledWith({
      conversationId: "~nec",
      topic: "computing",
      disclose: [],
      display: {
        text: "Computing",
        blob: {
          thinking: true,
          toolCalls: [{ toolName: "exec" }],
        },
      },
    });
  });

  test("publishes thinking state for a new run and sends thinking false when the run stops", async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter });

    await tracker.refreshRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    expect(reporter.publish).toHaveBeenCalledWith({
      conversationId: "~nec",
      thinking: true,
      toolNames: [],
    });

    await tracker.stopRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: "~nec",
      thinking: false,
      toolNames: [],
    });
  });

  test("throttles intermediate tool updates to at most one publish per second", async () => {
    vi.useFakeTimers();

    try {
      const reporter = {
        publish: vi.fn(async () => {}),
      };

      const tracker = createComputingPresenceTracker({ reporter });

      await tracker.refreshRun({
        conversationId: "~nec",
        runId: "run-1",
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await tracker.addToolCall({
        conversationId: "~nec",
        runId: "run-1",
        toolName: "web_fetch",
      });

      await tracker.addToolCall({
        conversationId: "~nec",
        runId: "run-1",
        toolName: "exec",
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: "~nec",
        thinking: true,
        toolNames: ["web_fetch", "exec"],
      });

      await tracker.clearToolCalls({
        conversationId: "~nec",
        runId: "run-1",
      });

      expect(reporter.publish).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: "~nec",
        thinking: true,
        toolNames: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("does not republish identical active state on refresh", async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter });

    await tracker.refreshRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    await tracker.refreshRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    expect(reporter.publish).toHaveBeenCalledTimes(1);
  });

  test("unions active runs in the same conversation", async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter, minUpdateIntervalMs: 0 });

    await tracker.refreshRun({
      conversationId: "chat/~bus/general",
      runId: "run-1",
    });
    await tracker.addToolCall({
      conversationId: "chat/~bus/general",
      runId: "run-1",
      toolName: "web_fetch",
    });

    await tracker.refreshRun({
      conversationId: "chat/~bus/general",
      runId: "run-2",
    });
    await tracker.addToolCall({
      conversationId: "chat/~bus/general",
      runId: "run-2",
      toolName: "exec",
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: "chat/~bus/general",
      thinking: true,
      toolNames: ["web_fetch", "exec"],
    });

    await tracker.stopRun({
      conversationId: "chat/~bus/general",
      runId: "run-1",
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: "chat/~bus/general",
      thinking: true,
      toolNames: ["exec"],
    });

    expect(reporter.publish).toHaveBeenCalledTimes(4);
  });

  test("does not republish thinking false when a stopped run is already missing", async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter, minUpdateIntervalMs: 0 });

    await tracker.refreshRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    await tracker.stopRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    await tracker.stopRun({
      conversationId: "~nec",
      runId: "run-1",
    });

    expect(reporter.publish).toHaveBeenCalledTimes(2);
  });
});
