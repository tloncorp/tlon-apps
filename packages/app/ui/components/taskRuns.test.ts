import { describe, expect, test, vi } from 'vitest';

import type { ContextLens } from './Channel/ContextLens/types';
import {
  formatRunDay,
  groupRunsByDay,
  runHistorySubtitle,
  taskRunError,
  taskRunOutcome,
  taskRunOutput,
} from './taskRuns';
import {
  taskRunDetailSections,
  taskRunHistorySections,
} from './taskRunSections';

// Local noon, so day arithmetic never straddles midnight in any zone.
const now = new Date(2026, 9, 12, 12, 0).getTime();
const hoursAgo = (hours: number) => now - hours * 3_600_000;

function run(overrides: Partial<ContextLens> = {}): ContextLens {
  return {
    lensId: 'lens',
    messageId: 'cron:abc:1',
    chatType: 'internal',
    runKind: 'cron',
    trigger: 'cron',
    model: null,
    provider: null,
    status: 'completed',
    error: null,
    createdAt: now,
    updatedAt: now,
    context: {
      currentMessage: true,
      threadMessages: 0,
      channelMessages: 0,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
    },
    persistence: {
      postsReply: false,
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: false,
    },
    tools: {
      ownerOnlyAvailable: [],
      called: [],
      callCount: 0,
      lastStartedAt: null,
    },
    lifecycle: {
      queuedMs: 0,
      durationMs: 1_000,
      timeoutMs: null,
      timedOut: false,
      deliveredMessageCount: 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
    cron: { jobId: 'job-1' },
    ...overrides,
  };
}

describe('taskRunOutcome', () => {
  test('trusts the host verdict over the lens status', () => {
    expect(taskRunOutcome(run())).toBe('successful');
    expect(
      taskRunOutcome(
        run({ cron: { jobId: 'job-1', outcome: { status: 'error' } } })
      )
    ).toBe('failed');
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              summary: 'Digest',
              deliveryStatus: 'not-delivered',
            },
          },
        })
      )
    ).toBe('failed');
    expect(taskRunOutcome(run({ status: 'no_reply' }))).toBe('no-output');
    expect(taskRunOutcome(run({ status: 'tool_running' }))).toBe('running');
    expect(taskRunOutcome(run({ status: 'timed_out' }))).toBe('failed');
  });

  test('reads a run that chose to say nothing as no output, not a failure', () => {
    for (const outcome of [
      { summary: 'NO_REPLY' },
      // The host stripped the token; the plugin saw the silent reply.
      { silent: true },
    ]) {
      expect(
        taskRunOutcome(
          run({
            cron: {
              jobId: 'job-1',
              outcome: {
                status: 'ok',
                delivered: false,
                deliveryStatus: 'not-delivered',
                ...outcome,
              },
            },
          })
        )
      ).toBe('no-output');
    }
    // An empty summary with no evidence of silence is unexplained.
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              delivered: false,
              deliveryStatus: 'not-delivered',
            },
          },
        })
      )
    ).toBe('failed');
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              deliveryStatus: 'not-delivered',
              deliveryError: 'channel not found',
            },
          },
        })
      )
    ).toBe('failed');
    // Unposted by `delivered` alone, when the status is left out.
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: { status: 'ok', summary: 'Digest', delivered: false },
          },
        })
      )
    ).toBe('failed');
    // A task that posts nowhere was never meant to deliver.
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              summary: 'Digest',
              delivered: false,
              deliveryStatus: 'not-requested',
            },
          },
        })
      )
    ).toBe('successful');
    // A delivery error is a failure even without a delivery status.
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: { status: 'ok', deliveryError: 'rate limited' },
          },
        })
      )
    ).toBe('failed');
    // Posted, even with no summary to show for it.
    expect(
      taskRunOutcome(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              delivered: true,
              deliveryStatus: 'delivered',
            },
          },
        })
      )
    ).toBe('successful');
  });

  test('explains a failure in the words it was reported in', () => {
    expect(
      taskRunError(
        run({
          error: 'lens error',
          cron: { jobId: 'job-1', outcome: { status: 'error', error: 'boom' } },
        })
      )
    ).toBe('boom');
    expect(
      taskRunError(
        run({
          cron: {
            jobId: 'job-1',
            outcome: {
              status: 'ok',
              summary: 'Digest',
              deliveryStatus: 'not-delivered',
            },
          },
        })
      )
    ).toBe('The output could not be posted.');
    expect(taskRunError(run())).toBeNull();
  });
});

describe('taskRunOutput', () => {
  test("prefers a test run's reply, then the summary, then what was posted", () => {
    expect(
      taskRunOutput(run({ cron: { jobId: 'job-1', test: true, output: 'Hi' } }))
    ).toBe('Hi');
    expect(
      taskRunOutput(
        run({
          outputs: [
            {
              messageId: 'm1',
              conversationId: 'chat/~zod/a',
              kind: 'channel',
              sentAt: now,
              preview: 'Posted digest',
            },
          ],
          cron: { jobId: 'job-1', outcome: { status: 'ok', summary: 'Sum' } },
        })
      )
    ).toBe('Sum');
    // A post is only a short preview, so it stands in for a summary that
    // is missing or silent.
    expect(
      taskRunOutput(
        run({
          outputs: [
            {
              messageId: 'm1',
              conversationId: 'chat/~zod/a',
              kind: 'channel',
              sentAt: now,
              preview: 'Posted digest',
            },
          ],
          cron: {
            jobId: 'job-1',
            outcome: { status: 'ok', summary: 'NO_REPLY' },
          },
        })
      )
    ).toBe('Posted digest');
    expect(taskRunOutput(run())).toBeNull();
    // NO_REPLY is the run saying nothing, not output to show.
    expect(
      taskRunOutput(
        run({
          cron: {
            jobId: 'job-1',
            outcome: { status: 'ok', summary: 'NO_REPLY' },
          },
        })
      )
    ).toBeNull();
  });
});

describe('runHistorySubtitle', () => {
  test('names the last scheduled run and how it went', () => {
    expect(runHistorySubtitle([run({ createdAt: hoursAgo(2) })], now)).toBe(
      'Last run Today, successful'
    );
    expect(
      runHistorySubtitle(
        [
          run({ createdAt: hoursAgo(1), cron: { jobId: 'job-1', test: true } }),
          run({ createdAt: hoursAgo(24), status: 'error' }),
        ],
        now
      )
    ).toBe('Last run Yesterday, failed');
  });

  test('falls back to tests, then to nothing', () => {
    expect(
      runHistorySubtitle(
        [run({ createdAt: hoursAgo(1), cron: { jobId: 'job-1', test: true } })],
        now
      )
    ).toBe('Last test Today, successful');
    expect(
      runHistorySubtitle(
        [
          run({
            status: 'tool_running',
            cron: { jobId: 'job-1', test: true },
          }),
        ],
        now
      )
    ).toBe('Testing now');
    expect(runHistorySubtitle([], now)).toBe('No runs yet');
  });
});

describe('formatRunDay', () => {
  test('reads relative days, then dates', () => {
    expect(formatRunDay(hoursAgo(1), now)).toBe('Today');
    expect(formatRunDay(hoursAgo(24), now)).toBe('Yesterday');
    expect(formatRunDay(hoursAgo(24 * 3), now)).toBe(
      new Date(hoursAgo(24 * 3)).toLocaleDateString([], { weekday: 'long' })
    );
    expect(formatRunDay(hoursAgo(24 * 30), now)).toBe(
      new Date(hoursAgo(24 * 30)).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    );
  });
});

describe('groupRunsByDay', () => {
  test('keeps order and cuts at each new day', () => {
    const days = groupRunsByDay(
      [
        run({ lensId: 'a', createdAt: hoursAgo(1) }),
        run({ lensId: 'b', createdAt: hoursAgo(2) }),
        run({ lensId: 'c', createdAt: hoursAgo(25) }),
      ],
      now
    );
    expect(
      days.map((day) => [day.label, day.runs.map((r) => r.lensId)])
    ).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
    ]);
  });
});

describe('taskRunHistorySections', () => {
  const sections = (overrides = {}) =>
    taskRunHistorySections({
      runs: [],
      now,
      onPressRun: vi.fn(),
      ...overrides,
    });

  test('says why there is nothing to show', () => {
    expect(sections()).toEqual([
      expect.objectContaining({
        key: 'empty',
        rows: [{ key: 'empty', title: 'No runs yet' }],
      }),
    ]);
    const onRetry = vi.fn();
    const [failed] = sections({ error: true, onRetry });
    expect(failed).toMatchObject({
      key: 'error',
      title: 'Could not load runs',
    });
    failed.rows[0].onPress?.();
    expect(onRetry).toHaveBeenCalled();
  });

  test('lists each day of runs, a test marked, newest first', () => {
    const onPressRun = vi.fn();
    const failed = run({
      lensId: 'failed',
      createdAt: hoursAgo(24),
      status: 'error',
      error: 'Provider overloaded',
    });
    const tested = run({
      lensId: 'tested',
      createdAt: hoursAgo(1),
      cron: { jobId: 'job-1', test: true, output: 'Three new threads' },
    });
    const result = sections({
      taskName: 'Daily digest',
      runs: [tested, failed],
      total: 5,
      onPressRun,
    });

    expect(result.map((section) => section.title ?? section.key)).toEqual([
      'task',
      'Today',
      'Yesterday',
    ]);
    expect(result[0].rows[0]).toMatchObject({
      title: 'Daily digest',
      value: '5 runs',
    });
    expect(result[1].rows[0]).toMatchObject({
      key: 'tested',
      value: 'Successful',
      subtitle: 'Three new threads',
      badge: 'Test',
    });
    expect(result[2].rows[0]).toMatchObject({
      value: 'Failed',
      subtitle: 'Provider overloaded',
    });
    expect(result[2].rows[0].badge).toBeUndefined();
    result[2].rows[0].onPress?.();
    expect(onPressRun).toHaveBeenCalledWith(failed);
  });

  test('keeps runs it could not refresh, and offers older ones', () => {
    const onLoadMore = vi.fn();
    const result = sections({
      runs: [run()],
      error: true,
      hasMore: true,
      onLoadMore,
    });
    expect(result[0].key).toBe('refresh-failed');
    const more = result.at(-1)!.rows[0];
    expect(more).toMatchObject({ title: 'Show older runs', action: true });
    more.onPress?.();
    expect(onLoadMore).toHaveBeenCalled();
    expect(
      sections({
        runs: [run()],
        hasMore: true,
        loadingMore: true,
        onLoadMore,
      }).at(-1)!.rows[0]
    ).toMatchObject({ title: 'Loading…', disabled: true });
  });
});

describe('taskRunDetailSections', () => {
  const sections = (lens: ContextLens, overrides = {}) =>
    taskRunDetailSections({
      lens,
      now,
      expandedTools: new Set(),
      onToggleTool: vi.fn(),
      ...overrides,
    });
  const section = (result: ReturnType<typeof sections>, key: string) =>
    result.find((candidate) => candidate.key === key)!;

  test('leads with the output, its outcome and where it went', () => {
    const posted = run({
      cron: {
        jobId: 'job-1',
        outcome: { status: 'ok', summary: 'Digest text', delivered: true },
      },
    });
    const result = sections(posted, { destinationLabel: 'Tlon · General' });
    expect(result[0]).toMatchObject({
      key: 'output',
      footer: 'Posted to Tlon · General.',
      rows: [{ key: 'output', title: 'Digest text', expanded: true }],
    });
    expect(section(result, 'run').rows[0]).toMatchObject({
      title: 'Outcome',
      value: 'Successful',
    });
    expect(section(result, 'posts')).toBeDefined();

    const failed = sections(
      run({ status: 'error', error: 'Provider overloaded' })
    );
    expect(failed[0].rows).toEqual([
      expect.objectContaining({ key: 'error', title: 'Provider overloaded' }),
    ]);
  });

  test('says a test posted nothing, and shows no posts', () => {
    const tested = sections(
      run({ cron: { jobId: 'job-1', test: true, output: 'Hi' } })
    );
    expect(tested[0].footer).toBe(
      'Test run. Nothing was posted and the schedule is unchanged.'
    );
    expect(tested.some((candidate) => candidate.key === 'posts')).toBe(false);
  });

  test('opens a tool call to its arguments', () => {
    const onToggleTool = vi.fn();
    const withTool = run({
      tools: {
        ownerOnlyAvailable: [],
        called: ['web_search'],
        callCount: 1,
        lastStartedAt: null,
        runs: [
          {
            id: 'call-1',
            name: 'web_search',
            callIndex: 1,
            status: 'completed',
            argumentSummary: 'query: news',
            argumentDetail: '{"query":"news"}',
            durationMs: 3_000,
          } as never,
        ],
      },
    });
    const closed = section(sections(withTool, { onToggleTool }), 'tools')
      .rows[0];
    expect(closed).toMatchObject({
      title: '1. web search',
      value: 'completed',
      subtitle: 'query: news · 3.0s',
      expanded: false,
    });
    closed.onPress?.();
    expect(onToggleTool).toHaveBeenCalledWith('call-1');
    expect(
      section(
        sections(withTool, { expandedTools: new Set(['call-1']) }),
        'tools'
      ).rows[0]
    ).toMatchObject({
      subtitle: 'query: news · 3.0s\n\n{"query":"news"}',
      expanded: true,
    });
  });

  test('opens the message that started a run, never a made-up one', () => {
    const onPressMessage = vi.fn();
    const messageRow = (lens: ContextLens) =>
      section(sections(lens, { onPressMessage }), 'trigger').rows.find(
        (row) => row.title === 'Message'
      )!;
    expect(messageRow(run()).onPress).toBeUndefined();

    const fromMessage = run({
      runKind: 'conversation',
      chatType: 'dm',
      triggerDetails: {
        messageId: '~zod/170',
        conversationId: '~zod',
        authorShip: '~zod',
      } as never,
    });
    messageRow(fromMessage).onPress?.();
    expect(onPressMessage).toHaveBeenCalledWith({
      postId: '~zod/170',
      channelId: '~zod',
      authorId: '~zod',
    });
  });
});
