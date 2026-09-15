import { describe, expect, it } from 'vitest';

import { stripImmutableCronUpdateAgentId } from './cron-tool-params.js';

describe('cron tool params', () => {
  it('removes a populated immutable agent id from update patches', () => {
    const params = {
      action: 'update',
      jobId: 'job-1',
      patch: {
        agentId: 'dev',
        payload: { toolsAllow: ['web_search'] },
      },
    };

    expect(stripImmutableCronUpdateAgentId(params)).toBe(true);
    expect(params).toEqual({
      action: 'update',
      jobId: 'job-1',
      patch: { payload: { toolsAllow: ['web_search'] } },
    });
  });

  it('removes a schema-padded null agent id from update patches', () => {
    const params = {
      action: 'update',
      patch: { agentId: null, description: 'updated description' },
    };

    expect(stripImmutableCronUpdateAgentId(params)).toBe(true);
    expect(params.patch).toEqual({ description: 'updated description' });
  });

  it('does not alter add calls or update patches without agent id', () => {
    const add = {
      action: 'add',
      job: { agentId: 'dev' },
    };
    const update = {
      action: 'update',
      patch: { description: 'updated description' },
    };

    expect(stripImmutableCronUpdateAgentId(add)).toBe(false);
    expect(stripImmutableCronUpdateAgentId(update)).toBe(false);
    expect(add).toEqual({ action: 'add', job: { agentId: 'dev' } });
    expect(update).toEqual({
      action: 'update',
      patch: { description: 'updated description' },
    });
  });

  it('ignores malformed tool params', () => {
    expect(stripImmutableCronUpdateAgentId(null)).toBe(false);
    expect(stripImmutableCronUpdateAgentId([])).toBe(false);
    expect(
      stripImmutableCronUpdateAgentId({ action: 'update', patch: null })
    ).toBe(false);
  });
});
