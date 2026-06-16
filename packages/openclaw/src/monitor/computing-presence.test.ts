import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
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

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    expect(reporter.publish).toHaveBeenCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: [],
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

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

      await tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'web_fetch',
      });

      await tracker.addToolCall({
        conversationId: '~nec',
        runId: 'run-1',
        toolName: 'exec',
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: ['web_fetch', 'exec'],
      });

      await tracker.clearToolCalls({
        conversationId: '~nec',
        runId: 'run-1',
      });

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

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    expect(reporter.publish).toHaveBeenCalledTimes(1);
  });

  test('republishes unchanged active state after the keepalive window so ship presence does not expire', async () => {
    vi.useFakeTimers();

    try {
      const reporter = {
        publish: vi.fn(async () => {}),
      };

      const tracker = createComputingPresenceTracker({ reporter });

      await tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(29_999);
      await tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });

      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await tracker.refreshRun({
        conversationId: '~nec',
        runId: 'run-1',
      });

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

    await tracker.refreshRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
    });
    await tracker.addToolCall({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
      toolName: 'web_fetch',
    });

    await tracker.refreshRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-2',
    });
    await tracker.addToolCall({
      conversationId: 'chat/~bus/general',
      runId: 'run-2',
      toolName: 'exec',
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: 'chat/~bus/general',
      thinking: true,
      toolNames: ['web_fetch', 'exec'],
    });

    await tracker.stopRun({
      conversationId: 'chat/~bus/general',
      runId: 'run-1',
    });

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

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
    });

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

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

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.addToolCall({
      conversationId: '~nec',
      runId: 'run-1',
      toolName: 'exec',
    });

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
    });

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

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

    await tracker.refreshRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    await tracker.stopRun({
      conversationId: '~nec',
      runId: 'run-1',
    });

    expect(reporter.publish).toHaveBeenCalledTimes(2);
  });
});
