import { afterEach, describe, expect, it } from 'vitest';

import { resolveOwnerOnlyToolBlock } from './owner-only-tools.js';
import {
  _testing,
  clearInternalSessionRuns,
  clearSessionRunContext,
  getSessionRole,
  getToolCallRole,
  recordSessionRunContext,
  setSessionRole,
} from './session-roles.js';

describe('session roles', () => {
  afterEach(() => {
    _testing.clearAll();
  });

  it('returns the stored role for an exact session key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'owner');
    expect(getSessionRole('agent:main:tlon:direct:~ten')).toBe('owner');
    expect(getSessionRole('agent:main:tlon:direct:~zod')).toBeUndefined();
  });

  it('falls back to the thread parent key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'user');
    expect(
      getSessionRole('agent:main:tlon:direct:~ten:thread:170.141.184')
    ).toBe('user');
  });

  it('prefers a role stored under the exact thread key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'owner');
    setSessionRole('agent:main:tlon:direct:~ten:thread:1', 'user');
    expect(getSessionRole('agent:main:tlon:direct:~ten:thread:1')).toBe('user');
  });

  it('returns undefined when neither thread nor parent key has a role', () => {
    expect(
      getSessionRole('agent:main:tlon:direct:~ten:thread:1')
    ).toBeUndefined();
  });
});

describe('tool-call roles for shared sessions', () => {
  const sessionKey = 'agent:main:main';
  const cronRun = { sessionKey, runId: 'cron-run', trigger: 'cron' };

  afterEach(() => {
    _testing.clearAll();
  });

  it.each(['cron', 'heartbeat'])(
    'allows a trusted %s run without changing the non-owner sender role',
    (trigger) => {
      setSessionRole(sessionKey, 'user');
      const run = { ...cronRun, trigger };
      recordSessionRunContext(run);

      for (const tool of ['mcp__call', 'linear__create_issue']) {
        expect(resolveOwnerOnlyToolBlock(tool, getToolCallRole(run))).toEqual({
          ownerOnly: true,
          blocked: false,
        });
      }
      expect(getSessionRole(sessionKey)).toBe('user');
      expect(
        resolveOwnerOnlyToolBlock(
          'mcp__call',
          getToolCallRole({ sessionKey, runId: 'interactive-run' })
        ).blocked
      ).toBe(true);
    }
  );

  it('requires both the recorded run ID and session key', () => {
    setSessionRole(sessionKey, 'user');
    setSessionRole('another-session', 'user');
    recordSessionRunContext(cronRun);

    expect(getToolCallRole({ sessionKey })).toBe('user');
    expect(getToolCallRole({ sessionKey, runId: 'another-run' })).toBe('user');
    expect(
      getToolCallRole({ sessionKey: 'another-session', runId: cronRun.runId })
    ).toBe('user');
  });

  it('does not infer a grant from an unrecorded trigger or incomplete context', () => {
    setSessionRole(sessionKey, 'user');
    expect(getToolCallRole(cronRun)).toBe('user');
    recordSessionRunContext({ sessionKey, trigger: 'cron' });
    recordSessionRunContext({ runId: cronRun.runId, trigger: 'cron' });
    recordSessionRunContext({ sessionKey, runId: cronRun.runId });
    expect(getToolCallRole(cronRun)).toBe('user');
  });

  it('keeps attribution across duplicate hooks and hooks without a trigger', () => {
    setSessionRole(sessionKey, 'user');
    recordSessionRunContext(cronRun);
    recordSessionRunContext(cronRun);
    recordSessionRunContext({ sessionKey, runId: cronRun.runId });
    expect(getToolCallRole(cronRun)).toBeUndefined();
  });

  it('revokes attribution when the host explicitly marks the run interactive', () => {
    setSessionRole(sessionKey, 'user');
    recordSessionRunContext(cronRun);
    recordSessionRunContext({ ...cronRun, trigger: 'user' });
    expect(getToolCallRole(cronRun)).toBe('user');
  });

  it('cleans up only the matching run at agent end', () => {
    setSessionRole(sessionKey, 'user');
    recordSessionRunContext(cronRun);
    clearSessionRunContext({ sessionKey, runId: 'older-run' });
    clearSessionRunContext({
      sessionKey: 'another-session',
      runId: cronRun.runId,
    });
    clearSessionRunContext({ sessionKey });
    expect(getToolCallRole(cronRun)).toBeUndefined();

    clearSessionRunContext(cronRun);
    expect(getToolCallRole(cronRun)).toBe('user');
    expect(getSessionRole(sessionKey)).toBe('user');
  });

  it('clears internal attribution at shutdown without erasing sender roles', () => {
    setSessionRole(sessionKey, 'user');
    recordSessionRunContext(cronRun);
    clearInternalSessionRuns();
    expect(getToolCallRole(cronRun)).toBe('user');
  });

  it('preserves owner and separate internal-session access', () => {
    setSessionRole(sessionKey, 'owner');
    expect(getToolCallRole({ sessionKey, runId: 'owner-run' })).toBe('owner');
    expect(
      getToolCallRole({
        sessionKey: 'agent:main:cron:job',
        runId: 'isolated-run',
      })
    ).toBeUndefined();
  });
});
