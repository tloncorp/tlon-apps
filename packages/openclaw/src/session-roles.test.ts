import { afterEach, describe, expect, it } from 'vitest';

import { resolveOwnerOnlyToolBlock } from './owner-only-tools.js';
import {
  _testing,
  clearSessionRuns,
  clearSessionRunContext,
  getToolCallRole,
  finishSenderDispatch,
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
    'openclaw',
    'tool_search',
    'tool_describe',
  ]) {
    expect(resolveOwnerOnlyToolBlock(tool, getToolCallRole(ctx)).blocked).toBe(
      blocked
    );
  }
}

afterEach(() => _testing.clearAll());

describe('run-scoped sender roles', () => {
  it('allows an attributed Tlon owner and restricts unclassified runs', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    expectMcpBlocked(ownerRun, false);
    expectMcpBlocked(userRun, true);
    expectMcpBlocked({ sessionKey }, true);
  });

  it('keeps a pending non-owner restriction on a later overlapping owner', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    expectMcpBlocked(userRun, true);
    expectMcpBlocked(ownerRun, true);
  });

  it('restricts an active owner before non-owner input can be steered into it', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    // Steering dispatch cleanup cannot restore the original run's authority.
    finishSenderDispatch(userRun);
    recordSessionRunContext({ ...ownerRun, trigger: 'user' });
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    expectMcpBlocked(ownerRun, true);
  });

  it('binds aliases and threads to the exact run', () => {
    const alias = 'agent:main:tlon:direct:~ten';
    recordSenderRole(ownerRun.runId, [sessionKey, alias], 'owner');
    expectMcpBlocked({ ...ownerRun, sessionKey: `${alias}:thread:1` }, false);
    expectMcpBlocked({ ...userRun, sessionKey: alias }, true);
    expectMcpBlocked({ ...ownerRun, sessionKey: 'another-session' }, true);
  });

  it('cleans only the matching run and fails closed after cleanup', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext({ ...ownerRun, sessionKey: 'other' });
    clearSessionRunContext({ sessionKey });
    expectMcpBlocked(ownerRun, false);
    clearSessionRunContext(ownerRun);
    expectMcpBlocked(ownerRun, true);
  });

  it('restricts active thread runs when non-owner input uses the parent route', () => {
    const threadRun = { ...ownerRun, sessionKey: `${sessionKey}:thread:1` };
    recordSenderRole(threadRun.runId, [threadRun.sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    expectMcpBlocked(threadRun, true);
  });

  it('does not restrict active runs in unrelated sessions', () => {
    recordSenderRole(ownerRun.runId, ['other-session'], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    expectMcpBlocked({ ...ownerRun, sessionKey: 'other-session' }, false);
  });

  it('retains pending input after agent end until dispatch completes', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    clearSessionRunContext(userRun);
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    finishSenderDispatch(userRun);
    expectMcpBlocked(ownerRun, true);
    clearSessionRunContext(ownerRun);
    const next = { ...ownerRun, runId: 'next-owner' };
    recordSenderRole(next.runId, [sessionKey], 'owner');
    expectMcpBlocked(next, false);
  });

  it('retains restrictions until every overlapping non-owner dispatch finishes', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    const other = { ...userRun, runId: 'other-user' };
    recordSenderRole(other.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    finishSenderDispatch(other);
    expectMcpBlocked(ownerRun, true);
  });

  it('uses the agent-end event run ID when context omits it', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext({ sessionKey }, { runId: ownerRun.runId });
    expectMcpBlocked(ownerRun, true);
  });

  it('cleans up by event run ID when the end context omits its session', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext({}, { runId: ownerRun.runId });
    expectMcpBlocked(ownerRun, true);
  });

  it('prefers context run ID over a different event run ID', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext(
      { sessionKey, runId: 'other' },
      { runId: ownerRun.runId }
    );
    expectMcpBlocked(ownerRun, false);
  });

  it.each(['discord', 'slack', 'webhook', 'webchat', 'tui'])(
    'restricts %s runs with missing hooks or changing host sender attribution',
    (messageProvider) => {
      // Host owner flags cannot grant authority outside Tlon. No external run
      // gains privileges that an unobserved steering message could inherit.
      const ctx = {
        sessionKey: `agent:main:${messageProvider}:room`,
        runId: 'external-run',
        trigger: 'user',
        messageProvider,
      };
      expectMcpBlocked(ctx, true);
      const ownerContext = { ...ctx, senderIsOwner: true };
      recordSessionRunContext(ownerContext);
      expectMcpBlocked(ctx, true);
      const nonOwnerContext = { ...ctx, senderIsOwner: false };
      recordSessionRunContext(nonOwnerContext);
      expectMcpBlocked(ctx, true);
      recordSessionRunContext(ctx);
      expectMcpBlocked(ctx, true);
    }
  );

  it('does not grant external runs access through a shared Tlon session key', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    const external = { ...ownerRun, runId: 'external-run', trigger: 'user' };
    recordSessionRunContext(external);
    expectMcpBlocked(external, true);
    expectMcpBlocked(ownerRun, false);
  });

  it('fails closed for missing tool context', () => {
    expectMcpBlocked({ runId: ownerRun.runId }, true);
  });

  it('does not infer internal authority from a session name', () => {
    expectMcpBlocked(
      { sessionKey: 'agent:main:subagent:child', runId: 'child' },
      true
    );
  });
});

describe('internal run attribution', () => {
  const cronRun = {
    agentId: 'main',
    jobId: 'job',
    sessionId: 'cron-session',
    sessionKey: 'agent:main:cron:job:run:cron-session',
    runId: 'cron-run',
    trigger: 'cron',
  };
  const cronJob = { id: 'job', sessionTarget: 'isolated' };

  it('allows an exact cron run without granting concurrent interactive runs access', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(cronRun, { cronJob });
    expectMcpBlocked(cronRun, false);
    expectMcpBlocked(userRun, true);
    expectMcpBlocked({ ...cronRun, runId: 'other' }, true);
  });

  it('restricts shared-history cron even after an owner turn or process restart', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    const sharedCron = { ...cronRun, sessionKey };
    recordSessionRunContext(sharedCron, {
      cronJob: { ...cronJob, sessionTarget: 'main' },
    });
    expectMcpBlocked(sharedCron, true);
    _testing.clearAll();
    recordSessionRunContext(sharedCron, { cronJob });
    expectMcpBlocked(sharedCron, true);
  });

  it.each([
    undefined,
    { id: 'job', sessionTarget: 'main' },
    { id: 'another-job', sessionTarget: 'isolated' },
  ])('requires verified isolated cron configuration: %j', (job) => {
    recordSessionRunContext(cronRun, { cronJob: job });
    expectMcpBlocked(cronRun, true);
  });

  it('rejects cron run keys that do not match the host session ID', () => {
    const run = { ...cronRun, sessionId: 'other-session' };
    recordSessionRunContext(run, { cronJob });
    expectMcpBlocked(run, true);
  });

  it('does not overwrite an attributed sender with an internal trigger', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext({ ...userRun, trigger: 'cron' });
    expectMcpBlocked(userRun, true);
  });

  it('clears run grants at shutdown', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(cronRun, { cronJob });
    clearSessionRuns();
    expectMcpBlocked(cronRun, true);
  });

  it('does not grant shared-history heartbeats access, even after an owner turn', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    const run = { ...heartbeatRun, sessionKey };
    recordSessionRunContext(run, {
      heartbeatSession: { sessionId: run.sessionId },
    });
    expectMcpBlocked(run, true);
  });

  it('blocks unverified heartbeats even without any in-memory sender history', () => {
    const run = { ...heartbeatRun, sessionKey };
    recordSessionRunContext(run);
    expectMcpBlocked(run, true);
  });

  it('preserves access for a verified isolated heartbeat with no external events', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(heartbeatRun, {
      heartbeatSession: isolatedSession,
    });
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
      recordSessionRunContext(heartbeatRun, {
        heartbeatSession: isolatedSession,
      });
      expectMcpBlocked(heartbeatRun, true);
      clearSessionRuns();
      recordSessionRunContext(heartbeatRun, {
        heartbeatSession: isolatedSession,
      });
      expectMcpBlocked(heartbeatRun, true);
    }
  );

  it('does not taint a separate isolated heartbeat source', () => {
    recordExternalSessionEvent('agent:other:main');
    recordSessionRunContext(heartbeatRun, {
      heartbeatSession: isolatedSession,
    });
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
    recordSessionRunContext(heartbeatRun, { heartbeatSession: entry });
    expectMcpBlocked(heartbeatRun, true);
  });
});
