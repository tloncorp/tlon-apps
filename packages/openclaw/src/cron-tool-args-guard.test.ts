import { describe, expect, it } from 'vitest';

import {
  CRON_ARGS_BLOCK_REASON,
  findForbiddenCronArgs,
  isCronArgsGuardEnabled,
} from './cron-tool-args-guard.js';

function nest(
  depth: number,
  leaf: Record<string, unknown>
): Record<string, unknown> {
  let node: Record<string, unknown> = leaf;
  for (let i = 0; i < depth; i += 1) {
    node = { a: node };
  }
  return node;
}

describe('findForbiddenCronArgs positives', () => {
  it('flags an empty fallbacks list on the nested job payload', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { name: 'daily', payload: { fallbacks: [] } },
      })
    ).toEqual([{ path: 'job.payload.fallbacks', kind: 'empty-fallbacks' }]);
  });

  it('flags best-effort delivery on the nested job', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { delivery: { bestEffort: true } },
      })
    ).toEqual([{ path: 'job.delivery.bestEffort', kind: 'best-effort' }]);
  });

  it('reports both findings in document order', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { payload: { fallbacks: [] }, delivery: { bestEffort: true } },
      })
    ).toEqual([
      { path: 'job.payload.fallbacks', kind: 'empty-fallbacks' },
      { path: 'job.delivery.bestEffort', kind: 'best-effort' },
    ]);
  });

  it('flags the data-wrapped spelling', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { data: { payload: { fallbacks: [] } } },
      })
    ).toEqual([
      { path: 'job.data.payload.fallbacks', kind: 'empty-fallbacks' },
    ]);
  });

  it('flags the job-wrapped spelling', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { job: { payload: { fallbacks: [] } } },
      })
    ).toEqual([{ path: 'job.job.payload.fallbacks', kind: 'empty-fallbacks' }]);
  });

  it('flags an empty fallbacks list on an update patch', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'update',
        id: 'job-1',
        patch: { payload: { fallbacks: [] } },
      })
    ).toEqual([{ path: 'patch.payload.fallbacks', kind: 'empty-fallbacks' }]);
  });

  it('flags best-effort delivery on an update patch', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'update',
        id: 'job-1',
        patch: { delivery: { bestEffort: true } },
      })
    ).toEqual([{ path: 'patch.delivery.bestEffort', kind: 'best-effort' }]);
  });

  it.each(['add', 'update'])(
    'flags the flat top-level spelling on %s',
    (action) => {
      expect(findForbiddenCronArgs('cron', { action, fallbacks: [] })).toEqual([
        { path: 'fallbacks', kind: 'empty-fallbacks' },
      ]);
    }
  );

  it('flags the namePayload spelling', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        namePayload: { fallbacks: [] },
      })
    ).toEqual([{ path: 'namePayload.fallbacks', kind: 'empty-fallbacks' }]);
  });

  it('flags padded keys and reports the trimmed path', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        'fallbacks ': [],
        'delivery ': { bestEffort: true },
      })
    ).toEqual([
      { path: 'fallbacks', kind: 'empty-fallbacks' },
      { path: 'delivery.bestEffort', kind: 'best-effort' },
    ]);
  });

  it('flags a value nested inside an array element', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        jobs: [{ name: 'a' }, { payload: { fallbacks: [] } }],
      })
    ).toEqual([{ path: 'jobs.1.payload.fallbacks', kind: 'empty-fallbacks' }]);
  });

  it('trims the action value before matching', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: ' add',
        job: { delivery: { bestEffort: true } },
      })
    ).toEqual([{ path: 'job.delivery.bestEffort', kind: 'best-effort' }]);
  });

  it.each([
    [
      'the capped path first',
      (job: Record<string, unknown>, deep: Record<string, unknown>) => ({
        action: 'add',
        deep,
        job,
      }),
    ],
    [
      'the shallow path first',
      (job: Record<string, unknown>, deep: Record<string, unknown>) => ({
        action: 'add',
        job,
        deep,
      }),
    ],
  ])(
    'flags a shallow occurrence of a node also reached past the depth cap, with %s',
    (_label, build) => {
      const job: Record<string, unknown> = { payload: { fallbacks: [] } };
      job.self = job;
      expect(findForbiddenCronArgs('cron', build(job, nest(15, job)))).toEqual([
        { path: 'job.payload.fallbacks', kind: 'empty-fallbacks' },
      ]);
    }
  );

  it.each([
    [
      'the capped path first',
      (jobs: unknown[], deep: Record<string, unknown>) => ({
        action: 'add',
        deep,
        jobs,
      }),
    ],
    [
      'the shallow path first',
      (jobs: unknown[], deep: Record<string, unknown>) => ({
        action: 'add',
        jobs,
        deep,
      }),
    ],
  ])(
    'flags a shallow occurrence of an array also reached past the depth cap, with %s',
    (_label, build) => {
      const jobs: unknown[] = [{ fallbacks: [] }];
      jobs.push(jobs);
      expect(
        findForbiddenCronArgs('cron', build(jobs, nest(14, { jobs })))
      ).toEqual([{ path: 'jobs.0.fallbacks', kind: 'empty-fallbacks' }]);
    }
  );
});

describe('findForbiddenCronArgs negatives', () => {
  it('allows a populated fallbacks list', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { payload: { fallbacks: ['openrouter/x'] } },
      })
    ).toEqual([]);
  });

  it('allows a null fallbacks value', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { payload: { fallbacks: null } },
      })
    ).toEqual([]);
  });

  it('allows bestEffort false', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { delivery: { bestEffort: false } },
      })
    ).toEqual([]);
  });

  it('allows a non-boolean bestEffort value', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        job: { delivery: { bestEffort: 'true' } },
      })
    ).toEqual([]);
  });

  it.each(['list', 'get', 'run', 'runs', 'remove', 'enable'])(
    'ignores the %s action',
    (action) => {
      expect(
        findForbiddenCronArgs('cron', {
          action,
          job: { payload: { fallbacks: [] }, delivery: { bestEffort: true } },
        })
      ).toEqual([]);
    }
  );

  it.each(['tlon', 'read'])('ignores the %s tool', (toolName) => {
    expect(
      findForbiddenCronArgs(toolName, {
        action: 'add',
        job: { payload: { fallbacks: [] } },
      })
    ).toEqual([]);
  });

  it.each([
    ['undefined', undefined],
    ['a string', 'add'],
    ['an array', [{ action: 'add', fallbacks: [] }]],
  ])('ignores params that are %s', (_label, params) => {
    expect(findForbiddenCronArgs('cron', params)).toEqual([]);
  });

  it('terminates on a cyclic params tree', () => {
    const job: Record<string, unknown> = { payload: { fallbacks: [] } };
    job.self = job;
    expect(findForbiddenCronArgs('cron', { action: 'add', job })).toEqual([
      { path: 'job.payload.fallbacks', kind: 'empty-fallbacks' },
    ]);
  });

  it('finds a value inside the depth cap', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        ...nest(10, { fallbacks: [] }),
      })
    ).toHaveLength(1);
  });

  it('finds a value on the deepest inspected object', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        ...nest(16, { fallbacks: [] }),
      })
    ).toEqual([
      { path: `${'a.'.repeat(16)}fallbacks`, kind: 'empty-fallbacks' },
    ]);
  });

  it('ignores a value one level below the deepest inspected object', () => {
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        ...nest(17, { fallbacks: [] }),
      })
    ).toEqual([]);
  });

  it('stops without throwing past the depth cap', () => {
    expect(() =>
      findForbiddenCronArgs('cron', {
        action: 'add',
        ...nest(40, { fallbacks: [] }),
      })
    ).not.toThrow();
    expect(
      findForbiddenCronArgs('cron', {
        action: 'add',
        ...nest(40, { fallbacks: [] }),
      })
    ).toEqual([]);
  });
});

describe('isCronArgsGuardEnabled', () => {
  it('defaults to enabled when unset', () => {
    expect(isCronArgsGuardEnabled({})).toBe(true);
  });

  it.each(['0', 'false', 'off', 'OFF', ' false '])(
    'is disabled by %s',
    (value) => {
      expect(isCronArgsGuardEnabled({ TLON_CRON_ARGS_GUARD: value })).toBe(
        false
      );
    }
  );

  it.each(['1', 'true', 'on', 'banana'])('stays enabled for %s', (value) => {
    expect(isCronArgsGuardEnabled({ TLON_CRON_ARGS_GUARD: value })).toBe(true);
  });
});

describe('CRON_ARGS_BLOCK_REASON', () => {
  it('stays one line within the owner-notice cap', () => {
    expect(CRON_ARGS_BLOCK_REASON).not.toMatch(/[\r\n]/);
    expect(CRON_ARGS_BLOCK_REASON.length).toBeLessThanOrEqual(200);
  });

  it('names both fields the model must remove', () => {
    expect(CRON_ARGS_BLOCK_REASON).toContain('fallbacks: []');
    expect(CRON_ARGS_BLOCK_REASON).toContain('bestEffort: true');
  });
});
