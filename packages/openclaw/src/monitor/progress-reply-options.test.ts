import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  type ComputingPresenceReporter,
  createComputingPresenceTracker,
} from './computing-presence.js';
import { buildProgressReplyOptions } from './progress-reply-options.js';

vi.mock('@tloncorp/api', () => ({
  clearConversationPresence: vi.fn(async () => {}),
  createComputingStatus: vi.fn(),
  getComputingStatusText: vi.fn(() => 'Computing'),
  serializeComputingStatus: vi.fn(),
  setConversationPresence: vi.fn(async () => {}),
}));

async function flushPresenceQueue() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function createMockPresence() {
  return {
    setCommentary: vi.fn(),
    stopRun: vi.fn(),
  };
}

function buildEnabled(
  computingPresence: Parameters<
    typeof buildProgressReplyOptions
  >[0]['computingPresence']
) {
  return buildProgressReplyOptions({
    enabled: true,
    presenceConversationId: '~nec',
    presenceRunId: 'run-1',
    computingPresence,
  });
}

describe('buildProgressReplyOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns the progress flags and both callbacks when enabled', () => {
    const options = buildEnabled(createMockPresence());

    expect(options).toEqual({
      onItemEvent: expect.any(Function),
      onQueuedFollowupSettled: expect.any(Function),
      commentaryProgressEnabled: true,
      suppressDefaultToolProgressMessages: true,
      allowProgressCallbacksWhenSourceDeliverySuppressed: true,
      preserveProgressCallbackStartOrder: true,
    });
  });

  test('returns nothing when disabled or without a presence conversation', () => {
    const computingPresence = createMockPresence();

    expect(
      buildProgressReplyOptions({
        enabled: false,
        presenceConversationId: '~nec',
        presenceRunId: 'run-1',
        computingPresence,
      })
    ).toEqual({});
    expect(
      buildProgressReplyOptions({
        enabled: true,
        presenceConversationId: null,
        presenceRunId: 'run-1',
        computingPresence,
      })
    ).toEqual({});
    expect(
      buildProgressReplyOptions({
        enabled: true,
        presenceConversationId: undefined,
        presenceRunId: 'run-1',
        computingPresence,
      })
    ).toEqual({});
  });

  test('forwards only preamble items to the run', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({ kind: 'tool', progressText: 'exec' });
    options.onItemEvent?.({ kind: 'command', progressText: 'ls' });
    options.onItemEvent?.({ progressText: 'no kind' });
    expect(computingPresence.setCommentary).not.toHaveBeenCalled();

    options.onItemEvent?.({ kind: 'preamble', progressText: 'Checking.' });
    expect(computingPresence.setCommentary).toHaveBeenCalledWith({
      conversationId: '~nec',
      runId: 'run-1',
      text: 'Checking.',
    });
  });

  test.each([
    { label: 'update', phase: 'update' },
    { label: 'end', phase: 'end' },
    { label: 'no', phase: undefined },
  ])('forwards a preamble with $label phase', ({ phase }) => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({
      kind: 'preamble',
      itemId: 'item-1',
      progressText: 'Checking.',
      ...(phase ? { phase } : {}),
    });

    expect(computingPresence.setCommentary).toHaveBeenCalledWith({
      conversationId: '~nec',
      runId: 'run-1',
      text: 'Checking.',
    });
  });

  test('a preamble with missing text clears the commentary', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({
      kind: 'preamble',
      itemId: 'item-1',
      progressText: 'Checking.',
    });
    options.onItemEvent?.({ kind: 'preamble', itemId: 'item-1' });

    expect(computingPresence.setCommentary).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      runId: 'run-1',
      text: '',
    });
  });

  test('ignores a doubled snapshot of the previous text', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({ kind: 'preamble', progressText: 'Checking.' });
    options.onItemEvent?.({
      kind: 'preamble',
      progressText: 'Checking.Checking.',
    });

    expect(computingPresence.setCommentary.mock.calls).toEqual([
      [{ conversationId: '~nec', runId: 'run-1', text: 'Checking.' }],
    ]);
  });

  test('a doubled snapshot does not replace the remembered text', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({ kind: 'preamble', progressText: 'Checking.' });
    options.onItemEvent?.({
      kind: 'preamble',
      progressText: 'Checking.Checking.',
    });
    options.onItemEvent?.({
      kind: 'preamble',
      progressText: 'Checking.Checking.',
    });

    const texts = computingPresence.setCommentary.mock.calls.map(
      ([params]) => params.text
    );
    expect(texts).toEqual(['Checking.']);
  });

  test('compares raw text before normalisation', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({ kind: 'preamble', progressText: 'Looking. ' });
    options.onItemEvent?.({
      kind: 'preamble',
      progressText: 'Looking. Looking. ',
    });

    const texts = computingPresence.setCommentary.mock.calls.map(
      ([params]) => params.text
    );
    expect(texts).toEqual(['Looking. ']);
  });

  test('forwards a genuinely longer snapshot', () => {
    const computingPresence = createMockPresence();
    const options = buildEnabled(computingPresence);

    options.onItemEvent?.({ kind: 'preamble', progressText: 'Checking' });
    options.onItemEvent?.({
      kind: 'preamble',
      progressText: 'Checking the docs.',
    });

    const texts = computingPresence.setCommentary.mock.calls.map(
      ([params]) => params.text
    );
    expect(texts).toEqual(['Checking', 'Checking the docs.']);
  });

  test('a doubled snapshot with no correction publishes the previous text', async () => {
    vi.useFakeTimers();

    try {
      const reporter = {
        publish: vi.fn<ComputingPresenceReporter['publish']>(async () => {}),
      };
      const tracker = createComputingPresenceTracker({ reporter });
      const options = buildEnabled(tracker);

      tracker.refreshRun({ conversationId: '~nec', runId: 'run-1' });
      await flushPresenceQueue();
      options.onItemEvent?.({ kind: 'preamble', progressText: 'Checking.' });
      options.onItemEvent?.({
        kind: 'preamble',
        progressText: 'Checking.Checking.',
      });
      await vi.advanceTimersByTimeAsync(1_000);

      const commentary = reporter.publish.mock.calls.map(
        ([params]) => params.commentary
      );
      expect(commentary).toEqual([null, 'Checking.']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('queued follow-up settlement stops a run that a tool call resurrected', async () => {
    const reporter = {
      publish: vi.fn<ComputingPresenceReporter['publish']>(async () => {}),
    };
    const tracker = createComputingPresenceTracker({
      reporter,
      minUpdateIntervalMs: 0,
    });
    const options = buildEnabled(tracker);
    const run = { conversationId: '~nec', runId: 'run-1' };

    tracker.refreshRun(run);
    await flushPresenceQueue();
    tracker.stopRun(run);
    await flushPresenceQueue();
    tracker.addToolCall({ ...run, toolName: 'exec' });
    await flushPresenceQueue();
    expect(reporter.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ thinking: true, toolNames: ['exec'] })
    );

    await options.onQueuedFollowupSettled?.();
    await flushPresenceQueue();

    expect(reporter.publish).toHaveBeenLastCalledWith({
      conversationId: '~nec',
      thinking: false,
      toolNames: [],
      commentary: null,
    });
  });
});
