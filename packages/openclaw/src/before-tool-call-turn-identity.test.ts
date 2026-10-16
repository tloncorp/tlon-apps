import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import entry from '../index.js';
import {
  _testing as boundaryTesting,
  claimTlonChoiceCall,
  claimTlonTaskPlanCall,
  getTlonSessionRunSurface,
  rememberTlonSessionRunSurface,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';
import { formatOwnerOnlyToolBlockReason } from './owner-only-tools.js';
import { _testing as rolesTesting, setSessionRole } from './session-roles.js';
import {
  RUN_ACTIVE_TTL_MS,
  _testing as identityTesting,
  noteInboundDispatching,
} from './turn-identity.js';

vi.mock('./monitor/agent-onboarding.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./monitor/agent-onboarding.js')>();
  return { ...actual, isAgentOnboardingCronJob: vi.fn(async () => false) };
});

type Ctx = { sessionKey?: string; runId?: string };
type BeforeToolCallHandler = (
  event: { toolName: string; params: Record<string, unknown> },
  ctx: Ctx
) => Promise<unknown>;
type AgentHook = (
  event: Record<string, unknown>,
  ctx: Ctx & { trigger?: string; messageProvider?: string; jobId?: string }
) => unknown;

/** Recording stand-in for the plugin api (see before-tool-call-cron.test.ts). */
function registerEntry(
  config: Record<string, unknown> = {
    channels: { tlon: { ownerDefault: true } },
  }
) {
  const hooks = new Map<string, unknown>();
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') return 'full';
      if (prop === 'config') return config;
      if (prop === 'on') {
        return (name: string, handler: unknown) => hooks.set(name, handler);
      }
      if (prop === 'toString' || prop === 'valueOf') return () => '[api]';
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return proxy;
    },
    apply: () => proxy,
  });
  entry.register(proxy as never);
  return {
    beforeToolCall: hooks.get('before_tool_call') as BeforeToolCallHandler,
    prepare: hooks.get('agent_turn_prepare') as AgentHook,
    modelCallStarted: hooks.get('model_call_started') as AgentHook,
    agentEnd: hooks.get('agent_end') as AgentHook,
  };
}

const GROUP = 'agent:main:tlon:group:chat/~h/general';
const OTHER_GROUP = 'agent:main:tlon:group:chat/~h/other';
const TLON_CALL = {
  toolName: 'tlon',
  params: { command: 'contacts self' },
};
const SELF_CALL = { params: { command: '--self contacts self' } };

function inbound(role: 'owner' | 'user', runId: string, sessionKey = GROUP) {
  setSessionRole(sessionKey, role);
  setTlonSessionSurface(sessionKey, {
    kind: 'group',
    senderRole: role,
    channelNest: 'chat/~h/general',
    messageId: `${role}/${runId}`,
  });
  noteInboundDispatching({ sessionKeys: [sessionKey], role });
  rememberTlonSessionRunSurface(runId, sessionKey, { senderRole: role });
}

describe('before_tool_call turn identity', () => {
  beforeEach(() => {
    identityTesting.clearAll();
    boundaryTesting.clearAll();
    rolesTesting.clearAll();
  });

  afterEach(() => {
    identityTesting.clearAll();
    boundaryTesting.clearAll();
    rolesTesting.clearAll();
  });

  it('still vetoes a non-owner turn with the owner-only reason', async () => {
    const { beforeToolCall } = registerEntry();
    inbound('user', 'run-1');
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-1' })
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('tlon'),
    });
  });

  it('leaves an owner-directed call unchanged', async () => {
    const { beforeToolCall } = registerEntry();
    inbound('owner', 'run-1');
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-1' })
    ).resolves.toBeUndefined();
  });

  it.each([
    ['an isolated cron run', 'agent:main:cron:job-1:run:1', 'cron'],
    ['a main-session cron run', 'agent:main:cron:j:run:1', 'heartbeat'],
    [
      'a heartbeat on the owner-DM main session',
      'agent:main:main',
      'heartbeat',
    ],
    ['a subagent', 'agent:main:subagent:abc', 'user'],
    ['an ACP session', 'agent:main:acp:6f0c2a1e', 'user'],
    ['a restart catch-up run', GROUP, 'manual'],
  ])('rewrites %s to --self', async (_label, sessionKey, trigger) => {
    const { beforeToolCall, prepare } = registerEntry();
    setSessionRole('agent:main:main', 'owner');
    inbound('owner', 'run-0');
    const ctx = { sessionKey, runId: 'internal-1' };
    await prepare({}, { ...ctx, trigger, jobId: 'job-1' });
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(SELF_CALL);
  });

  it('rewrites a control-UI or gateway run to --self', async () => {
    const { beforeToolCall, prepare } = registerEntry();
    inbound('owner', 'run-0');
    const ctx = { sessionKey: GROUP, runId: 'webchat-1' };
    await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'webchat' });
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(SELF_CALL);
  });

  it("rewrites the owner's queued follow-up (fresh runId, no snapshot) to --self", async () => {
    const { beforeToolCall, prepare } = registerEntry();
    inbound('owner', 'run-1');
    const ctx = { sessionKey: GROUP, runId: 'follow-1' };
    await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(SELF_CALL);
  });

  it('revokes owner-only tools for an owner run once a non-owner message reached its session', async () => {
    const { beforeToolCall } = registerEntry();
    inbound('owner', 'run-1');
    inbound('owner', 'run-plain', OTHER_GROUP);
    inbound('user', 'run-2');
    inbound('owner', 'run-3');
    const ctx = { sessionKey: GROUP, runId: 'run-1' };
    for (const call of [
      TLON_CALL,
      {
        toolName: 'tlon',
        params: { command: '--self settings allow-dm ~mug' },
      },
      { toolName: 'read', params: { path: 'MEMORY.md' } },
      { toolName: 'cron', params: { action: 'list' } },
    ]) {
      await expect(beforeToolCall(call, ctx)).resolves.toMatchObject({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason(call.toolName),
      });
    }
    // An owner run on another session, and the owner's new run, are untouched.
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: OTHER_GROUP, runId: 'run-plain' })
    ).resolves.toBeUndefined();
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-3' })
    ).resolves.toBeUndefined();
  });

  it('keeps a non-owner turn blocked after the session role flips to owner mid-turn', async () => {
    const { beforeToolCall } = registerEntry();
    inbound('user', 'run-a');
    setSessionRole(GROUP, 'owner');
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-a' })
    ).resolves.toMatchObject({ block: true });
  });

  it('demotes owner runs on a sessions_send call', async () => {
    const { beforeToolCall } = registerEntry();
    inbound('owner', 'run-1');
    await beforeToolCall(
      { toolName: 'sessions_send', params: { label: 'main', message: 'hi' } },
      { sessionKey: 'agent:main:main', runId: 'sender' }
    );
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-1' })
    ).resolves.toMatchObject({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('tlon'),
    });
  });

  it('keeps a run first seen at model_call_started on --self after preparation', async () => {
    const { beforeToolCall, prepare, modelCallStarted } = registerEntry();
    inbound('owner', 'run-0');
    const ctx = { sessionKey: GROUP, runId: 'model-first' };
    await modelCallStarted({}, ctx);
    await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(SELF_CALL);
  });

  it('keeps identity, demotion and publication claims across agent_end', async () => {
    const { beforeToolCall, agentEnd } = registerEntry();
    inbound('owner', 'run-1');
    expect(
      claimTlonChoiceCall({
        toolCallId: 'choice-1',
        runId: 'run-1',
        sessionKey: GROUP,
      })
    ).toBeUndefined();
    inbound('owner', 'run-2');
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'plan-1',
        runId: 'run-2',
        sessionKey: GROUP,
      })
    ).toBeUndefined();
    inbound('user', 'run-3');

    for (const runId of ['run-1', 'run-2']) {
      await agentEnd(
        { messages: [], success: true },
        { sessionKey: GROUP, runId }
      );
    }

    expect(getTlonSessionRunSurface('run-1')).toMatchObject({
      senderRole: 'owner',
    });
    // The demoted runs stay vetoed on their next attempt.
    for (const runId of ['run-1', 'run-2']) {
      await expect(
        beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId })
      ).resolves.toMatchObject({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason('tlon'),
      });
    }
    expect(
      claimTlonChoiceCall({
        toolCallId: 'choice-2',
        runId: 'run-1',
        sessionKey: GROUP,
      })
    ).toContain('choice was already posted');
    expect(
      claimTlonTaskPlanCall({
        toolCallId: 'plan-2',
        runId: 'run-2',
        sessionKey: GROUP,
      })
    ).toContain('Only one task plan');
  });

  describe('hour boundary', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('keeps a non-owner run vetoed when it is retried after an hour', async () => {
      const { beforeToolCall, prepare } = registerEntry();
      inbound('user', 'retry-user');
      const ctx = { sessionKey: GROUP, runId: 'retry-user' };
      await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
      vi.advanceTimersByTime(RUN_ACTIVE_TTL_MS + 60_000);
      inbound('owner', 'run-2');
      await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason('tlon'),
      });
    });

    it('keeps a run first seen on a vetoed tool call vetoed after an hour', async () => {
      const { beforeToolCall, prepare } = registerEntry();
      inbound('user', 'veto-first');
      const ctx = { sessionKey: GROUP, runId: 'veto-first' };
      // No preparation or model hook: the vetoed call is the first sight.
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toMatchObject({
        block: true,
      });
      vi.advanceTimersByTime(61 * 60_000);
      inbound('owner', 'run-2');
      await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toMatchObject({
        block: true,
      });
    });

    it('keeps a snapshotless bot run on --self while active, and vetoes it after an hour idle', async () => {
      const { beforeToolCall, prepare } = registerEntry();
      setSessionRole(GROUP, 'owner');
      const ctx = { sessionKey: GROUP, runId: 'gateway-1' };
      await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(SELF_CALL);
      vi.advanceTimersByTime(RUN_ACTIVE_TTL_MS + 60_000);
      inbound('owner', 'run-2');
      await prepare({}, { ...ctx, trigger: 'user', messageProvider: 'tlon' });
      // Never the owner; a tombstone fails closed for owner-only tools.
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toMatchObject({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason('tlon'),
      });
    });

    it('vetoes every owner-only tool for an owner run idle for over an hour', async () => {
      const { beforeToolCall } = registerEntry();
      inbound('owner', 'run-1');
      const ctx = { sessionKey: GROUP, runId: 'run-1' };
      await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();
      vi.advanceTimersByTime(RUN_ACTIVE_TTL_MS + 60_000);
      for (const call of [
        TLON_CALL,
        { toolName: 'read', params: { path: 'MEMORY.md' } },
        { toolName: 'cron', params: { action: 'list' } },
      ]) {
        await expect(beforeToolCall(call, ctx)).resolves.toMatchObject({
          block: true,
          blockReason: formatOwnerOnlyToolBlockReason(call.toolName),
        });
      }
    });

    it('keeps an owner run the owner past an hour while it stays active', async () => {
      const { beforeToolCall } = registerEntry();
      inbound('owner', 'run-1');
      const ctx = { sessionKey: GROUP, runId: 'run-1' };
      for (let step = 0; step < 3; step += 1) {
        vi.advanceTimersByTime(30 * 60_000);
        await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();
      }
    });
  });

  it('does not rewrite to --self with ownerDefault off', async () => {
    const { beforeToolCall, prepare } = registerEntry({});
    inbound('owner', 'run-0');
    const ctx = { sessionKey: 'agent:main:cron:job-1:run:1', runId: 'cron-1' };
    await prepare({}, { ...ctx, trigger: 'cron' });
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();
    inbound('user', 'run-1');
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-1' })
    ).resolves.toMatchObject({ block: true });
  });

  it("never lends the tool's owner to a run answering another account's message", async () => {
    const { beforeToolCall } = registerEntry();
    setSessionRole(GROUP, 'owner');
    setTlonSessionSurface(GROUP, {
      kind: 'group',
      senderRole: 'owner',
      channelNest: 'chat/~h/general',
      messageId: 'owner/second',
    });
    rememberTlonSessionRunSurface('run-second', GROUP, {
      senderRole: 'owner',
      accountId: 'second',
    });
    rememberTlonSessionRunSurface('run-default', GROUP, {
      senderRole: 'owner',
      accountId: 'default',
    });
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-second' })
    ).resolves.toEqual(SELF_CALL);
    await expect(
      beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-default' })
    ).resolves.toBeUndefined();
  });

  it('revokes owner-only tools for roleless runs on a session that gets a non-owner message', async () => {
    const { beforeToolCall, prepare } = registerEntry();
    // An internal run on the group session, seen before any role was stored.
    const ctx = { sessionKey: GROUP, runId: 'internal-1' };
    await prepare({}, { ...ctx, trigger: 'manual' });
    await expect(
      beforeToolCall({ toolName: 'read', params: { path: 'x' } }, ctx)
    ).resolves.toBeUndefined();
    inbound('user', 'run-mug');
    for (const call of [
      TLON_CALL,
      { toolName: 'read', params: { path: 'MEMORY.md' } },
      { toolName: 'cron', params: { action: 'list' } },
    ]) {
      await expect(beforeToolCall(call, ctx)).resolves.toMatchObject({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason(call.toolName),
      });
    }
  });

  it("revokes a subagent run's owner-only tools on a sessions_send into its session", async () => {
    const { beforeToolCall, prepare } = registerEntry();
    const subagent = 'agent:main:subagent:abc';
    const ctx = { sessionKey: subagent, runId: 'sub-1' };
    await prepare({}, { ...ctx, trigger: 'user' });
    await expect(
      beforeToolCall({ toolName: 'read', params: { path: 'x' } }, ctx)
    ).resolves.toBeUndefined();
    inbound('user', 'run-mug');
    await beforeToolCall(
      {
        toolName: 'sessions_send',
        params: { sessionKey: subagent, message: 'hi' },
      },
      { sessionKey: GROUP, runId: 'run-mug' }
    );
    await expect(
      beforeToolCall({ toolName: 'read', params: { path: 'x' } }, ctx)
    ).resolves.toMatchObject({ block: true });
  });

  it("vetoes an owner run once another account's owner message reaches its session", async () => {
    const { beforeToolCall } = registerEntry();
    const ownerOn = (accountId: string, runId: string) => {
      setSessionRole(GROUP, 'owner');
      setTlonSessionSurface(GROUP, {
        kind: 'group',
        senderRole: 'owner',
        channelNest: 'chat/~h/general',
        messageId: `owner/${runId}`,
      });
      noteInboundDispatching({
        sessionKeys: [GROUP],
        role: 'owner',
        accountId,
      });
      rememberTlonSessionRunSurface(runId, GROUP, {
        senderRole: 'owner',
        accountId,
      });
    };
    ownerOn('default', 'run-a');
    const ctx = { sessionKey: GROUP, runId: 'run-a' };
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();
    ownerOn('default', 'run-a2');
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();
    ownerOn('second', 'run-b');
    await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toMatchObject({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('tlon'),
    });
  });
});
