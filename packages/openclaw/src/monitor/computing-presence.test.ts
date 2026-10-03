import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  COMMENTARY_MAX_CHARS,
  type ComputingPresenceReporter,
  createComputingPresenceReporter,
  createComputingPresenceTracker,
  formatCommentaryForPresence,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
        commentary: null,
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
        commentary: null,
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
        commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
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
      commentary: null,
      thinking: false,
      toolNames: [],
    });
  });
});
function createRecordingReporter() {
  return {
    publish: vi.fn<ComputingPresenceReporter['publish']>(async () => {}),
  };
}

function publishedFor(
  reporter: ReturnType<typeof createRecordingReporter>,
  conversationId: string
) {
  return reporter.publish.mock.calls
    .map(([params]) => params)
    .filter((params) => params.conversationId === conversationId);
}

describe('computing presence commentary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reporter sends commentary as the display text and keeps the blob unchanged', async () => {
    const reporter = createComputingPresenceReporter();

    await reporter.publish({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
      commentary: 'Checking the release notes.',
    });

    expect(setConversationPresence).toHaveBeenLastCalledWith(
      expect.objectContaining({
        display: {
          text: 'Checking the release notes.',
          blob: { thinking: true, toolCalls: [{ toolName: 'exec' }] },
        },
      })
    );

    await reporter.publish({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
      commentary: null,
    });

    expect(setConversationPresence).toHaveBeenLastCalledWith(
      expect.objectContaining({
        display: {
          text: 'Computing',
          blob: { thinking: true, toolCalls: [{ toolName: 'exec' }] },
        },
      })
    );
  });

  test('publishes commentary and lets later commentary replace it', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.refreshRun(run);
    tracker.setCommentary({ ...run, text: 'Checking the release notes.' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: [],
      commentary: 'Checking the release notes.',
    });

    tracker.setCommentary({ ...run, text: 'Reading the changelog.' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: [],
      commentary: 'Reading the changelog.',
    });
  });

  test('commentary survives clearToolCalls and a following tool call', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.setCommentary({ ...run, text: 'Checking files.' });
    tracker.addToolCall({ ...run, toolName: 'exec' });
    await flushPresenceQueue();
    tracker.clearToolCalls(run);
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: [],
      commentary: 'Checking files.',
    });

    tracker.addToolCall({ ...run, toolName: 'read' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['read'],
      commentary: 'Checking files.',
    });
  });

  test('identical commentary does not republish; changed commentary does', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.setCommentary({ ...run, text: 'Checking files.' });
    await flushPresenceQueue();
    tracker.setCommentary({ ...run, text: 'Checking  files. ' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(1);

    tracker.setCommentary({ ...run, text: 'Reading files.' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(2);
    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ commentary: 'Reading files.' })
    );
  });

  test('rapid snapshots coalesce to one publish per throttle window with the latest text', async () => {
    vi.useFakeTimers();

    try {
      const reporter = createRecordingReporter();
      const tracker = createComputingPresenceTracker({ reporter });
      const run = { conversationId: '~nec', runId: 'run-1' };

      tracker.refreshRun(run);
      await flushPresenceQueue();
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      tracker.setCommentary({ ...run, text: 'Checking' });
      tracker.setCommentary({ ...run, text: 'Checking the' });
      tracker.setCommentary({ ...run, text: 'Checking the docs.' });
      await flushPresenceQueue();
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(reporter.publish).toHaveBeenCalledTimes(2);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: [],
        commentary: 'Checking the docs.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('empty or whitespace-only commentary clears back to the label', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.addToolCall({ ...run, toolName: 'exec' });
    tracker.setCommentary({ ...run, text: 'Checking files.' });
    await flushPresenceQueue();
    tracker.setCommentary({ ...run, text: ' \n\t ' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: true,
      toolNames: ['exec'],
      commentary: null,
    });

    tracker.setCommentary({ ...run, text: 'Reading files.' });
    await flushPresenceQueue();
    tracker.setCommentary({ ...run, text: '' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ thinking: true, commentary: null })
    );
  });

  test('commentary for a stopped run publishes nothing and does not resurrect it', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.refreshRun(run);
    await flushPresenceQueue();
    tracker.stopRun(run);
    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenCalledTimes(2);

    tracker.setCommentary({ ...run, text: 'Late commentary.' });
    await flushPresenceQueue();
    tracker.refreshRun(run);
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(2);
    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ thinking: false })
    );
  });

  test('stopping a run with commentary waiting behind the throttle ends in a clear', async () => {
    vi.useFakeTimers();

    try {
      const reporter = createRecordingReporter();
      const tracker = createComputingPresenceTracker({ reporter });
      const run = { conversationId: '~nec', runId: 'run-1' };

      tracker.refreshRun(run);
      await flushPresenceQueue();
      tracker.setCommentary({ ...run, text: 'Checking files.' });
      await flushPresenceQueue();
      tracker.stopRun(run);
      await flushPresenceQueue();
      await vi.advanceTimersByTimeAsync(5_000);

      const calls = publishedFor(reporter, '~nec');
      expect(calls.at(-1)).toMatchObject({ thinking: false, commentary: null });
      expect(calls.some((call) => call.commentary !== null)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test('stopping a run with commentary queued behind an unresolved publish ends in a clear', async () => {
    let resolveFirstPublish: (() => void) | undefined;
    const reporter = {
      publish: vi
        .fn<ComputingPresenceReporter['publish']>()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveFirstPublish = resolve;
            })
        )
        .mockResolvedValue(undefined),
    };
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.refreshRun(run);
    await flushPresenceQueue();
    tracker.setCommentary({ ...run, text: 'Checking files.' });
    tracker.stopRun(run);
    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenCalledTimes(1);

    resolveFirstPublish?.();
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenCalledTimes(2);
    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
      commentary: null,
    });
  });

  test('keepalive re-publish keeps the commentary text', async () => {
    vi.useFakeTimers();

    try {
      const reporter = createRecordingReporter();
      const tracker = createComputingPresenceTracker({ reporter });
      const run = { conversationId: '~nec', runId: 'run-1' };

      tracker.setCommentary({ ...run, text: 'Checking files.' });
      await flushPresenceQueue();
      expect(reporter.publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      tracker.refreshRun(run);
      await flushPresenceQueue();

      expect(reporter.publish).toHaveBeenCalledTimes(2);
      expect(reporter.publish).toHaveBeenLastCalledWith({
        conversationId: '~nec',
        thinking: true,
        toolNames: [],
        commentary: 'Checking files.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('the most recently updated run wins regardless of how often each run updated', async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const runA = { conversationId: 'chat/~bus/general', runId: 'run-a' };
    const runB = { conversationId: 'chat/~bus/general', runId: 'run-b' };

    for (let index = 1; index <= 5; index += 1) {
      tracker.setCommentary({ ...runA, text: `A step ${index}.` });
    }
    tracker.setCommentary({ ...runB, text: 'B step 1.' });
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ thinking: true, commentary: 'B step 1.' })
    );

    tracker.stopRun(runB);
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ thinking: true, commentary: 'A step 5.' })
    );

    tracker.stopRun(runA);
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: 'chat/~bus/general',
      thinking: false,
      toolNames: [],
      commentary: null,
    });
  });

  test("a second conversation's commentary does not appear in the first", async () => {
    const reporter = createRecordingReporter();
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });

    tracker.setCommentary({
      conversationId: '~nec',
      runId: 'run-1',
      text: 'Checking files.',
    });
    tracker.setCommentary({
      conversationId: '~bus',
      runId: 'run-2',
      text: 'Reading mail.',
    });
    await flushPresenceQueue();

    expect(
      publishedFor(reporter, '~nec').map((call) => call.commentary)
    ).toEqual(['Checking files.']);
    expect(
      publishedFor(reporter, '~bus').map((call) => call.commentary)
    ).toEqual(['Reading mail.']);
  });
});

describe('formatCommentaryForPresence', () => {
  const codePointLength = (text: string) => Array.from(text).length;

  test('collapses whitespace and returns null when nothing is left', () => {
    expect(formatCommentaryForPresence('  Checking\n the \t docs.  ')).toBe(
      'Checking the docs.'
    );
    expect(formatCommentaryForPresence(' \n\t ')).toBeNull();
    expect(formatCommentaryForPresence('')).toBeNull();
  });

  test('leaves text at the limit untouched', () => {
    const text = 'a'.repeat(COMMENTARY_MAX_CHARS);
    expect(formatCommentaryForPresence(text)).toBe(text);
  });

  test('cuts over-limit text at a word boundary with the ellipsis inside the limit', () => {
    // Spaces fall at every seventh position, so the hard-cut point (99) lands
    // inside a word and the cut has to move back to the space at 97.
    const result = formatCommentaryForPresence('abcdef '.repeat(20));

    expect(result).toBe(`${'abcdef '.repeat(13)}abcdef…`);
    expect(codePointLength(result!)).toBeLessThanOrEqual(COMMENTARY_MAX_CHARS);
  });

  test('hard-cuts a single over-limit token', () => {
    const result = formatCommentaryForPresence('x'.repeat(150));

    expect(result).toBe(`${'x'.repeat(COMMENTARY_MAX_CHARS - 1)}…`);
  });

  test('never splits a surrogate pair at the cut point', () => {
    const text = `${'a'.repeat(COMMENTARY_MAX_CHARS - 2)}${'😀'.repeat(5)}`;
    const result = formatCommentaryForPresence(text);

    expect(result).toBe(`${'a'.repeat(COMMENTARY_MAX_CHARS - 2)}😀…`);
    expect(codePointLength(result!)).toBe(COMMENTARY_MAX_CHARS);
  });
});
