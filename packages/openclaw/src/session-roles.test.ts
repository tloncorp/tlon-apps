import { afterEach, describe, expect, it } from 'vitest';

import { resolveOwnerOnlyToolBlock } from './owner-only-tools.js';
import {
  _testing,
  clearSessionRuns,
  clearSessionRunContext,
  getToolCallRole,
  recordExternalSessionEvent,
  recordSenderRole,
  recordSessionRunContext,
} from './session-roles.js';

const sessionKey = 'agent:main:main';
const userRun = { sessionKey, runId: 'user-run' };
const ownerRun = { sessionKey, runId: 'owner-run' };
const heartbeatRun = {
  sessionKey: `${sessionKey}:heartbeat`,
  sessionId: 'fresh-heartbeat-session',
  runId: 'heartbeat-run',
  trigger: 'heartbeat',
};
const isolatedSession = {
  sessionId: heartbeatRun.sessionId,
  heartbeatIsolatedBaseSessionKey: sessionKey,
};

function expectMcpBlocked(
  ctx: Parameters<typeof getToolCallRole>[0],
  blocked: boolean
) {
  for (const tool of [
    'mcp__call',
    'linear__create_issue',
    'sessions_spawn',
    'sessions_send',
  ]) {
    expect(resolveOwnerOnlyToolBlock(tool, getToolCallRole(ctx)).blocked).toBe(
      blocked
    );
  }
}

afterEach(() => _testing.clearAll());

describe('run-scoped sender roles', () => {
  it('keeps a non-owner restricted while a later owner turn shares its session', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    expectMcpBlocked(userRun, true);
    expectMcpBlocked(ownerRun, false);
    expectMcpBlocked({ sessionKey, runId: 'queued-run' }, true);
    expectMcpBlocked({ sessionKey }, true);
  });

  it('does not downgrade an active owner when a non-owner arrives', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    expectMcpBlocked(ownerRun, false);
    expectMcpBlocked(userRun, true);
  });

  it('binds aliases and thread keys to the same run, not other runs or sessions', () => {
    const alias = 'agent:main:tlon:direct:~ten';
    recordSenderRole(ownerRun.runId, [sessionKey, alias], 'owner');
    expectMcpBlocked({ ...ownerRun, sessionKey: `${alias}:thread:1` }, false);
    expectMcpBlocked({ ...userRun, sessionKey: alias }, true);
    expectMcpBlocked(
      { ...ownerRun, sessionKey: 'agent:main:tlon:group:other' },
      true
    );
  });

  it('cleans only the matching run and fails closed after cleanup', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    clearSessionRunContext({ ...ownerRun, sessionKey: 'other' });
    clearSessionRunContext({ sessionKey });
    expectMcpBlocked(ownerRun, false);
    clearSessionRunContext(ownerRun);
    expectMcpBlocked(ownerRun, true);
    expectMcpBlocked(userRun, true);
  });

  it('fails closed for missing tool context', () => {
    expectMcpBlocked({ runId: ownerRun.runId }, true);
  });

  it('preserves separate internal-session access', () => {
    expectMcpBlocked(
      { sessionKey: 'agent:main:subagent:child', runId: 'child' },
      false
    );
  });
});

describe('internal run attribution', () => {
  const cronRun = { sessionKey, runId: 'cron-run', trigger: 'cron' };

  it('allows an exact cron run without granting concurrent interactive runs access', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(cronRun);
    expectMcpBlocked(cronRun, false);
    expectMcpBlocked(userRun, true);
    expectMcpBlocked({ ...cronRun, runId: 'other' }, true);
  });

  it('does not overwrite an attributed sender with an internal trigger', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext({ ...userRun, trigger: 'cron' });
    expectMcpBlocked(userRun, true);
  });

  it('clears run grants at shutdown while retaining known Tlon sessions', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(cronRun);
    clearSessionRuns();
    expectMcpBlocked(cronRun, true);
  });

  it('does not grant shared-history heartbeats access, even after an owner turn', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    const run = { ...heartbeatRun, sessionKey };
    recordSessionRunContext(run, { sessionId: run.sessionId });
    expectMcpBlocked(run, true);
  });

  it('blocks unverified heartbeats even without any in-memory sender history', () => {
    const run = { ...heartbeatRun, sessionKey };
    recordSessionRunContext(run);
    expectMcpBlocked(run, true);
  });

  it('preserves access for a verified isolated heartbeat with no external events', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(heartbeatRun, isolatedSession);
    recordSessionRunContext(heartbeatRun);
    recordSessionRunContext({ ...heartbeatRun, trigger: undefined });
    expectMcpBlocked(heartbeatRun, false);
    expectMcpBlocked(userRun, true);
    expectMcpBlocked({ ...heartbeatRun, runId: 'unverified-heartbeat' }, true);
  });

  it.each([sessionKey, heartbeatRun.sessionKey])(
    'blocks external events queued on %s from elevating an isolated heartbeat',
    (eventSession) => {
      recordExternalSessionEvent(eventSession);
      recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
      recordSessionRunContext(heartbeatRun, isolatedSession);
      expectMcpBlocked(heartbeatRun, true);
      clearSessionRuns();
      recordSessionRunContext(heartbeatRun, isolatedSession);
      expectMcpBlocked(heartbeatRun, true);
    }
  );

  it('does not taint a separate isolated heartbeat source', () => {
    recordExternalSessionEvent('agent:other:main');
    recordSessionRunContext(heartbeatRun, isolatedSession);
    expectMcpBlocked(heartbeatRun, false);
  });

  it.each([
    { sessionId: 'stale-session', heartbeatIsolatedBaseSessionKey: sessionKey },
    { sessionId: heartbeatRun.sessionId },
    {
      sessionId: heartbeatRun.sessionId,
      heartbeatIsolatedBaseSessionKey: 'other',
    },
  ])('rejects missing or mismatched isolation metadata: %j', (entry) => {
    recordSessionRunContext(heartbeatRun, entry);
    expectMcpBlocked(heartbeatRun, true);
  });
});
