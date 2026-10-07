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

  it('restricts an active owner before non-owner input can be steered into it', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    // The steering dispatch ends while tools retain the original owner's ID.
    clearSessionRunContext(userRun);
    recordSessionRunContext({
      ...ownerRun,
      trigger: 'user',
      messageProvider: 'webchat',
    });
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    expectMcpBlocked(ownerRun, true);
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
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext({ ...ownerRun, sessionKey: 'other' });
    clearSessionRunContext({ sessionKey });
    expectMcpBlocked(ownerRun, false);
    clearSessionRunContext(ownerRun);
    expectMcpBlocked(ownerRun, true);
    expectMcpBlocked(userRun, true);
  });

  it('restricts an active thread run when a non-owner steers its parent route', () => {
    const threadRun = { ...ownerRun, sessionKey: `${sessionKey}:thread:1` };
    recordSessionRunContext({
      ...threadRun,
      trigger: 'user',
      messageProvider: 'webchat',
    });
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    clearSessionRunContext(userRun);
    expectMcpBlocked(threadRun, true);
  });

  it('does not restrict active runs in unrelated sessions', () => {
    recordSenderRole(ownerRun.runId, ['other-session'], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    expectMcpBlocked({ ...ownerRun, sessionKey: 'other-session' }, false);
  });

  it.each(['webchat', 'tui', 'discord'])(
    'allows a later host-attributed %s run in a shared main session',
    (messageProvider) => {
      recordSenderRole(userRun.runId, [sessionKey], 'user');
      clearSessionRunContext(userRun);
      recordSessionRunContext({
        ...ownerRun,
        trigger: 'user',
        messageProvider,
      });
      expectMcpBlocked(ownerRun, false);
      expectMcpBlocked({ ...ownerRun, runId: 'unattributed' }, true);
    }
  );

  it('restricts an active WebChat run when non-owner steering arrives', () => {
    const ctx = { ...ownerRun, trigger: 'user', messageProvider: 'webchat' };
    recordSessionRunContext(ctx);
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    clearSessionRunContext(userRun);
    recordSessionRunContext(ctx);
    expectMcpBlocked(ownerRun, true);
    clearSessionRunContext(ownerRun);
    const next = { ...ctx, runId: 'next-webchat-run' };
    recordSessionRunContext(next);
    expectMcpBlocked(next, false);
  });

  it('does not grant an unclassified Tlon run another channel’s authority', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext({
      ...ownerRun,
      trigger: 'user',
      messageProvider: 'tlon',
    });
    expectMcpBlocked(ownerRun, true);
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
