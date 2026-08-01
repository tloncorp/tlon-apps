import { describe, expect, test } from 'vitest';

import { stripEmptyCronToolsAllow } from './cron-params.js';

const jobWith = (payload: Record<string, unknown>) => ({
  action: 'add',
  job: {
    name: 'Research update',
    schedule: { kind: 'cron', expr: '0 9 * * 1', tz: 'America/New_York' },
    sessionTarget: 'isolated',
    payload: { kind: 'agentTurn', message: 'Search the web…', ...payload },
  },
});

describe('stripEmptyCronToolsAllow', () => {
  test('drops an empty allow-list, which would leave the run with no tools', () => {
    const repaired = stripEmptyCronToolsAllow(jobWith({ toolsAllow: [] }));
    expect(repaired).not.toBeNull();
    const payload = (repaired as any).job.payload;
    expect('toolsAllow' in payload).toBe(false);
    // Everything else survives untouched.
    expect(payload.message).toBe('Search the web…');
    expect((repaired as any).job.schedule.tz).toBe('America/New_York');
    expect((repaired as any).action).toBe('add');
  });

  test('leaves a real allow-list alone — that one was chosen', () => {
    expect(
      stripEmptyCronToolsAllow(jobWith({ toolsAllow: ['web_search'] }))
    ).toBeNull();
  });

  test('does nothing when the field is absent', () => {
    expect(stripEmptyCronToolsAllow(jobWith({}))).toBeNull();
  });

  test('does not mutate the original params', () => {
    const original = jobWith({ toolsAllow: [] });
    stripEmptyCronToolsAllow(original);
    expect(original.job.payload.toolsAllow).toEqual([]);
  });

  test('ignores calls that carry no job payload', () => {
    expect(stripEmptyCronToolsAllow({ action: 'list' })).toBeNull();
    expect(stripEmptyCronToolsAllow({ action: 'rm', job: {} })).toBeNull();
    expect(stripEmptyCronToolsAllow(undefined)).toBeNull();
    expect(stripEmptyCronToolsAllow('nope')).toBeNull();
    expect(stripEmptyCronToolsAllow([])).toBeNull();
  });
});
