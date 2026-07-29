import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  type ComputingPresenceReporter,
  createComputingPresenceReporter,
  createComputingPresenceTracker,
} from './computing-presence.js';

const {
  clearConversationPresence,
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
} = vi.hoisted(() => ({
  clearConversationPresence: vi.fn(async () => {}),
  createComputingStatus: vi.fn(({ thinking, toolCalls }) => ({
    thinking,
    toolCalls,
  })),
  getComputingStatusText: vi.fn(() => 'Computing'),
  serializeComputingStatus: vi.fn(({ thinking, toolCalls }) => ({
    thinking,
    toolCalls,
  })),
  setConversationPresence: vi.fn(async () => {}),
}));

vi.mock('@tloncorp/api', () => ({
  clearConversationPresence,
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
}));

async function flushPresenceQueue() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe('createComputingPresenceTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('publishes active presence with an explicit backend timeout', async () => {
    const reporter = createComputingPresenceReporter();

    await reporter.publish({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
    });

    expect(setConversationPresence).toHaveBeenCalledWith({
      conversationId: '~nec',
      topic: 'computing',
      disclose: [],
      timeout: '~m1.s30',
      display: {
        text: 'Computing',
        blob: {
          thinking: true,
          toolCalls: [{ toolName: 'exec' }],
        },
      },
    });
    expect(clearConversationPresence).not.toHaveBeenCalled();
  });

  test('clears computing presence when publishing idle state', async () => {
    const reporter = createComputingPresenceReporter();

    await reporter.publish({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });

    expect(clearConversationPresence).toHaveBeenCalledWith({
      conversationId: '~nec',
      topic: 'computing',
    });
    expect(setConversationPresence).not.toHaveBeenCalled();
  });

  test('publishes thinking state for a new run and sends thinking false when the run stops', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: [],
    });

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });
  });

  test('throttles intermediate tool updates to at most one publish per second', async () => {
    vi.useFakeTimers();

    try {
      const reporter = {
        publish: vi.fn(async () => {}),
      };

      const tracker = createComputingPresenceTracker({ reporter });

      tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'web_fetch',
      });

      tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'exec',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: ['web_fetch', 'exec'],
      });

      tracker.clearToolCalls({
        conversationId: '~nec',
        runId: 'run-1',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('does not republish identical active state on refresh', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({ reporter });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(1);
  });

  test('republishes unchanged active state after the keepalive window so ship presence does not expire', async () => {
    vi.useFakeTimers();

    try {
      const reporter = {
        publish: vi.fn(async () => {}),
      };

      const tracker = createComputingPresenceTracker({ reporter });

      tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(29_999);
      tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(2);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('unions active runs in the same conversation', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    tracker.refreshRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
    });
    await flushPresenceQueue();
    tracker.addToolCall({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
      toolName: 'web_fetch',
    });
    await flushPresenceQueue();

    tracker.refreshRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-2',
    });
    await flushPresenceQueue();
    tracker.addToolCall({
      conversationId: 'chat/~bus/general',
      runId: 'run-2',
      toolName: 'exec',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: 'chat/~bus/general',
      thinking: true,
      toolNames: ['web_fetch', 'exec'],
    });

    tracker.stopRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: 'chat/~bus/general',
      thinking: true,
      toolNames: ['exec'],
    });

    expect(reporter.publish).toHaveBeenCalledTimes(4);
  });

  test('keepalive refresh does not resurrect a stopped run', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(2);
  });

  test('a tool call resumes a stopped run', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.addToolCall({
      conversationId: '~nec',
      runId: 'run-1',
      toolName: 'exec',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
    });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });
  });

  test('does not republish thinking false when a stopped run is already missing', async () => {
    const reporter = {
      publish: vi.fn(async () => {}),
    };

    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(2);
  });

  test('lifecycle updates return immediately and coalesce behind a stalled publish', async () => {
    let resolveFirstPublish: (() => void) | undefined;
    const firstPublish = new Promise<void>((resolve) => {
      resolveFirstPublish = resolve;
    });
    const reporter = {
      publish: vi
        .fn<ComputingPresenceReporter['publish']>()
        .mockImplementationOnce(() => firstPublish)
        .mockResolvedValue(undefined),
    };
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    expect(
      tracker.refreshRun({ conversationId: '~nec', runId: 'run-1' })
    ).toBeUndefined();
    expect(reporter.publish).not.toHaveBeenCalled();

    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenCalledTimes(1);

    expect(
      tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'web_fetch',
      })
    ).toBeUndefined();
    expect(
      tracker.clearToolCalls({ conversationId: '~nec', runId: 'run-1' })
    ).toBeUndefined();
    expect(
      tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'exec',
      })
    ).toBeUndefined();
    expect(reporter.publish).toHaveBeenCalledTimes(1);

    resolveFirstPublish?.();
    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
    });
    expect(reporter.publish).toHaveBeenCalledTimes(2);

    expect(
      tracker.stopRun({ conversationId: '~nec', runId: 'run-1' })
    ).toBeUndefined();
    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });
  });
});
