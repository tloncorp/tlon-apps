import { describe, expect, test } from 'vitest';

import type { ContextLens } from './Channel/ContextLens/types';
import {
  formatRunDay,
  groupRunsByDay,
  runHistorySubtitle,
  taskRunError,
  taskRunOutcome,
  taskRunOutput,
} from './taskRuns';

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
