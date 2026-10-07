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
    expectMcpBlocked(ownerRun, true);
    expectMcpBlocked({ sessionKey, runId: 'queued-run' }, true);
    expectMcpBlocked({ sessionKey }, true);
  });

  it('restricts an active owner before non-owner input can be steered into it', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    // The steering dispatch ends while tools retain the original owner's ID.
    finishSenderDispatch(userRun);
    recordSessionRunContext(
      {
        ...ownerRun,
        trigger: 'user',
      },
      { senderIsOwner: true }
    );
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
    finishSenderDispatch(userRun);
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
    recordSessionRunContext(
      {
        ...threadRun,
        trigger: 'user',
      },
      { senderIsOwner: true }
    );
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    expectMcpBlocked(threadRun, true);
  });

  it('does not restrict active runs in unrelated sessions', () => {
    recordSenderRole(ownerRun.runId, ['other-session'], 'owner');
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    expectMcpBlocked({ ...ownerRun, sessionKey: 'other-session' }, false);
  });

  it.each(['webchat', 'tui', 'discord'])(
    'allows a host-authenticated owner from %s in a shared main session',
    (messageProvider) => {
      recordSenderRole(userRun.runId, [sessionKey], 'user');
      finishSenderDispatch(userRun);
      const ctx = { ...ownerRun, trigger: 'user', messageProvider };
      recordSessionRunContext(ctx, { senderIsOwner: true });
      expectMcpBlocked(ownerRun, false);
      expectMcpBlocked({ ...ownerRun, runId: 'unattributed' }, true);
    }
  );

  it('restricts an active WebChat run when non-owner steering arrives', () => {
    const ctx = { ...ownerRun, trigger: 'user', messageProvider: 'webchat' };
    recordSessionRunContext(ctx, { senderIsOwner: true });
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    recordSessionRunContext(ctx, { senderIsOwner: true });
    expectMcpBlocked(ownerRun, true);
    clearSessionRunContext(ownerRun);
    const next = { ...ctx, runId: 'next-webchat-run' };
    recordSessionRunContext(next, { senderIsOwner: true });
    expectMcpBlocked(next, false);
  });

  it('does not grant an unclassified Tlon run another channel’s authority', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(
      {
        ...ownerRun,
        trigger: 'user',
      },
      { senderIsOwner: undefined }
    );
    expectMcpBlocked(ownerRun, true);
  });

  it('restricts a host run whose first hook arrives while steering is pending', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    // Agent end is not dispatch completion: the steering decision is pending.
    clearSessionRunContext(userRun);
    const ctx = { ...ownerRun, trigger: 'user', messageProvider: 'webchat' };
    recordSessionRunContext(ctx, { senderIsOwner: true });
    finishSenderDispatch(userRun);
    recordSessionRunContext(ctx, { senderIsOwner: true });
    expectMcpBlocked(ownerRun, true);
    clearSessionRunContext(ownerRun);
    const next = { ...ctx, runId: 'next-owner' };
    recordSessionRunContext(next, { senderIsOwner: true });
    expectMcpBlocked(next, false);
  });

  it('retains restrictions until every overlapping non-owner dispatch finishes', () => {
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    const other = { ...userRun, runId: 'other-user' };
    recordSenderRole(other.runId, [sessionKey], 'user');
    finishSenderDispatch(userRun);
    recordSessionRunContext(
      {
        ...ownerRun,
        trigger: 'user',
      },
      { senderIsOwner: true }
    );
    finishSenderDispatch(other);
    expectMcpBlocked(ownerRun, true);
  });

  it('uses the agent-end event run ID when context omits it', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    clearSessionRunContext({ sessionKey }, { runId: ownerRun.runId });
    expectMcpBlocked(ownerRun, true);
  });

  it('cleans up by event run ID even when the end context omits its session', () => {
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

  it('does not retain channel-scoped aliases for historical correspondents', () => {
    for (let i = 0; i < 1000; i++) {
      const key = `agent:main:tlon:direct:ship-${i}`;
      recordSenderRole(`run-${i}`, [sessionKey, key], 'user');
      finishSenderDispatch({ runId: `run-${i}`, sessionKey: key });
    }
    expect(_testing.knownSessionCount()).toBe(1);
    expectMcpBlocked({ sessionKey: `${sessionKey}:thread:1` }, true);
    expectMcpBlocked(
      { sessionKey: 'agent:main:tlon:direct:ship-999:thread:1' },
      true
    );
  });

  it.each(['webchat', 'tui', 'discord', 'slack', 'unknown'])(
    'does not infer owner authority from the %s provider',
    (messageProvider) => {
      for (const senderIsOwner of [false, undefined]) {
        const ctx = {
          sessionKey: `agent:main:${messageProvider}:room`,
          runId: `${messageProvider}-${senderIsOwner}`,
          trigger: 'user',
          messageProvider,
        };
        recordSessionRunContext(ctx, { senderIsOwner });
        expectMcpBlocked(ctx, true);
      }
    }
  );

  it('does not promote an unverified sender on a later owner-claiming hook', () => {
    const ctx = { ...ownerRun, trigger: 'user' };
    recordSessionRunContext(ctx, { senderIsOwner: undefined });
    recordSessionRunContext(ctx, { senderIsOwner: true });
    expectMcpBlocked(ctx, true);
  });

  it('preserves Tlon sender attribution when the host sender bit differs', () => {
    recordSenderRole(ownerRun.runId, [sessionKey], 'owner');
    recordSessionRunContext(
      { ...ownerRun, trigger: 'user' },
      { senderIsOwner: false }
    );
    expectMcpBlocked(ownerRun, false);
    recordSenderRole(userRun.runId, [sessionKey], 'user');
    recordSessionRunContext(
      { ...userRun, trigger: 'user' },
      { senderIsOwner: true }
    );
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

  it('clears run grants at shutdown while retaining known Tlon sessions', () => {
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
