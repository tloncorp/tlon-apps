import { describe, expect, test } from 'vitest';

import { sanitizeCronToolParams } from './cron-params.js';

const jobWith = (extra: Record<string, unknown>) => ({
  action: 'add',
  job: {
    name: 'Research update',
    schedule: { kind: 'cron', expr: '0 9 * * 1', tz: 'America/New_York' },
    sessionTarget: 'isolated',
    payload: { kind: 'agentTurn', message: 'Search the web…' },
    ...extra,
  },
});

describe('sanitizeCronToolParams', () => {
  test('drops an empty allow-list, which would leave the run with no tools', () => {
    const repaired = sanitizeCronToolParams(
      jobWith({
        payload: { kind: 'agentTurn', message: 'Search…', toolsAllow: [] },
      })
    );
    const payload = (repaired as any).job.payload;
    expect('toolsAllow' in payload).toBe(false);
    expect(payload.message).toBe('Search…');
  });

  test('leaves a real allow-list alone — that one was chosen', () => {
    expect(
      sanitizeCronToolParams(
        jobWith({
          payload: {
            kind: 'agentTurn',
            message: 'Search…',
            toolsAllow: ['web_search'],
          },
        })
      )
    ).toBeNull();
  });

  // The exact delivery block a live run sent, which the scheduler rejected.
  test('repairs the delivery block the model actually sends', () => {
    const repaired = sanitizeCronToolParams(
      jobWith({
        delivery: {
          mode: 'announce',
          channel: 'tlon',
          to: 'chat/~ten/v255lkpb',
          threadId: '',
          bestEffort: true,
          accountId: '',
          failureDestination: {
            channel: '',
            to: '',
            accountId: '',
            mode: 'announce',
          },
        },
      })
    );
    expect((repaired as any).job.delivery).toEqual({
      mode: 'announce',
      channel: 'tlon',
      to: 'chat/~ten/v255lkpb',
      bestEffort: true,
    });
  });

  test('keeps a failureDestination when the delivery itself has a target', () => {
    const dest = { channel: 'tlon', to: 'chat/~ten/x', mode: 'announce' };
    const repaired = sanitizeCronToolParams(
      jobWith({
        delivery: { mode: 'announce', to: 'chat/~ten/x', accountId: '' },
      })
    );
    expect((repaired as any).job.delivery.to).toBe('chat/~ten/x');
    expect(
      sanitizeCronToolParams(
        jobWith({
          delivery: {
            mode: 'announce',
            to: 'chat/~ten/x',
            failureDestination: dest,
          },
        })
      )
    ).toBeNull();
  });

  test('drops a delivery that pruning reduced to a bare mode', () => {
    // {mode: 'announce'} with no target still fails scheduler validation,
    // so the husk has to go entirely rather than shrink.
    const repaired = sanitizeCronToolParams(
      jobWith({
        delivery: { mode: 'announce', channel: '', to: '', accountId: '' },
      })
    );
    expect('delivery' in (repaired as any).job).toBe(false);
  });

  test('keeps an explicit no-delivery mode, target or not', () => {
    // `none` disables runner fallback delivery and needs no target — dropping
    // it would default the job back to announce, un-silencing it.
    const repaired = sanitizeCronToolParams(
      jobWith({
        delivery: { mode: 'none', channel: '', to: '', accountId: '' },
      })
    );
    expect((repaired as any).job.delivery).toEqual({ mode: 'none' });
    expect(
      sanitizeCronToolParams(jobWith({ delivery: { mode: 'none' } }))
    ).toBeNull();
  });

  test('drops a run count below the schema minimum', () => {
    const repaired = sanitizeCronToolParams(
      jobWith({ failureAlert: { after: 0, channel: '' } })
    );
    expect('failureAlert' in (repaired as any).job).toBe(false);
  });

  test('leaves a boolean failureAlert and a real run count alone', () => {
    expect(sanitizeCronToolParams(jobWith({ failureAlert: true }))).toBeNull();
    expect(
      sanitizeCronToolParams(jobWith({ failureAlert: { after: 3 } }))
    ).toBeNull();
  });

  test('does nothing to a call that was already well formed', () => {
    expect(sanitizeCronToolParams(jobWith({}))).toBeNull();
    expect(sanitizeCronToolParams({ action: 'list' })).toBeNull();
    expect(sanitizeCronToolParams(undefined)).toBeNull();
    expect(sanitizeCronToolParams('nope')).toBeNull();
  });

  test('does not mutate the original params', () => {
    const original = jobWith({
      payload: { kind: 'agentTurn', toolsAllow: [] },
      delivery: { mode: 'announce', accountId: '' },
    });
    sanitizeCronToolParams(original);
    expect((original.job as any).payload.toolsAllow).toEqual([]);
    expect((original.job as any).delivery.accountId).toBe('');
  });
});
