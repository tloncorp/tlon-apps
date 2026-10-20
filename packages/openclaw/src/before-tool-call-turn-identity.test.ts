import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { _testing as approvalsTesting } from './tlon-call-approvals.js';
import { runTlonCommand } from './tlon-command-runner.js';
import {
  RUN_ACTIVE_TTL_MS,
  _testing as identityTesting,
  noteCrossSessionSend,
  noteInboundDispatching,
} from './turn-identity.js';

// The bot's CLI never runs here; a call that reaches it records its argv.
vi.mock('./tlon-command-runner.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./tlon-command-runner.js')>();
  return { ...actual, runTlonCommand: vi.fn(async () => 'ran') };
});

vi.mock('./monitor/agent-onboarding.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./monitor/agent-onboarding.js')>();
  return { ...actual, isAgentOnboardingCronJob: vi.fn(async () => false) };
});

type Ctx = { sessionKey?: string; runId?: string };
type BeforeToolCallHandler = (
  event: {
    toolName: string;
    params: Record<string, unknown>;
    toolCallId?: string;
  },
  ctx: Ctx
) => Promise<unknown>;
type AgentHook = (
  event: Record<string, unknown>,
  ctx: Ctx & { trigger?: string; messageProvider?: string; jobId?: string }
) => unknown;

type TlonTool = {
  name: string;
  description: string;
  execute: (
    id: string,
    params: { command: string }
  ) => Promise<{ content: Array<{ text: string }> }>;
};
type ToolFactory = (ctx: { workspaceDir: string }) => TlonTool | null;

/** Recording stand-in for the plugin api (see before-tool-call-cron.test.ts). */
function registerEntry(
  config: Record<string, unknown> = {
    channels: { tlon: { ownerDefault: true, ownerShip: '~zod' } },
  },
  warn?: (message: string) => void
) {
  const hooks = new Map<string, unknown>();
  const tools: ToolFactory[] = [];
  // The registration snapshot is `api.config`; a reload changes only what
  // `api.runtime.config.loadConfig()` returns.
  let liveConfig = config;
  const runtime: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'config') return { loadConfig: () => liveConfig };
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        return proxy;
      },
    }
  );
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') return 'full';
      if (prop === 'config') return config;
      if (prop === 'runtime') return runtime;
      if (prop === 'logger' && warn) {
        return new Proxy(
          {},
          { get: (_t, level) => (level === 'warn' ? warn : () => undefined) }
        );
      }
      if (prop === 'registerTool') {
        return (factory: unknown) => {
          if (typeof factory === 'function') tools.push(factory as ToolFactory);
        };
      }
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
    reloadConfig: (next: Record<string, unknown>) => {
      liveConfig = next;
    },
    tlonTool: () =>
      tools
        .map((factory) => factory({ workspaceDir: '/tmp' }))
        .find((tool) => tool?.name === 'tlon'),
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
    approvalsTesting.clearAll();
    vi.mocked(runTlonCommand).mockClear();
  });

  afterEach(() => {
    identityTesting.clearAll();
    boundaryTesting.clearAll();
    rolesTesting.clearAll();
    approvalsTesting.clearAll();
  });

  /**
   * A tlon call as core makes it: the gate, then the tool's execute with the
   * same call id and the params the gate returned.
   */
  async function callTlon(
    harness: Pick<ReturnType<typeof registerEntry>, 'beforeToolCall'>,
    tool: TlonTool | undefined,
    command: string,
    ctx: Ctx,
    id: string,
    betweenGateAndExecute: () => void = () => {}
  ): Promise<string> {
    const outcome = (await harness.beforeToolCall(
      { toolName: 'tlon', params: { command }, toolCallId: id },
      ctx
    )) as { block?: boolean; params?: { command: string } } | undefined;
    if (outcome?.block) return 'blocked';
    betweenGateAndExecute();
    const result = await tool!.execute(id, {
      command: outcome?.params?.command ?? command,
    });
    return result.content[0].text;
  }

  const ranArgs = () =>
    vi.mocked(runTlonCommand).mock.lastCall?.[1] as string[] | undefined;

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

  describe('a channels.tlon reload that flips ownerDefault', () => {
    const ON = {
      channels: { tlon: { ownerDefault: true, ownerShip: '~zod' } },
    };
    const OFF = { channels: { tlon: {} } };
    const CRON = { sessionKey: 'agent:main:cron:job-1:run:1', runId: 'cron-1' };
    // Rejected with the flag in both states, with a message that names the
    // state, so the executor's reading is visible without running the CLI.
    const CREDENTIAL_SETTINGS = { command: '--config /x.json settings get' };

    it.each([
      ['true to false', ON, OFF, false],
      ['false to true', OFF, ON, true],
    ])(
      'takes effect without re-registering: %s',
      async (_label, initial, reloaded, ownerDefault) => {
        const { beforeToolCall, prepare, reloadConfig, tlonTool } =
          registerEntry(initial);
        inbound('owner', 'run-0');
        await prepare({}, { ...CRON, trigger: 'cron' });
        const before = tlonTool();
        reloadConfig(reloaded);

        await expect(beforeToolCall(TLON_CALL, CRON)).resolves.toEqual(
          ownerDefault ? SELF_CALL : undefined
        );
        // The tool resolved before the reload executes with the new value too.
        const text = await callTlon(
          { beforeToolCall },
          before,
          CREDENTIAL_SETTINGS.command,
          CRON,
          'reload'
        );
        expect(text).toContain(
          ownerDefault
            ? 'Commands run as the owner by default'
            : 'are not accepted on settings, browser or hooks'
        );
        expect(tlonTool()!.description).toContain(
          ownerDefault
            ? 'Commands act as your owner by default'
            : 'Commands act as this bot.'
        );
      }
    );
  });

  describe('a channels.tlon reload that changes ownerShip', () => {
    const withOwner = (
      ownerShip: string,
      extra: Record<string, unknown> = {}
    ) => ({
      channels: { tlon: { ownerDefault: true, ownerShip, ...extra } },
    });
    // No credential file exists for either owner here, so the executor's
    // fail-closed error names the owner it would act as without running the
    // CLI.
    let callCount = 0;
    const actsAs = async (
      harness: Pick<ReturnType<typeof registerEntry>, 'beforeToolCall'>,
      tool: TlonTool | undefined,
      runId: string
    ) =>
      callTlon(
        harness,
        tool,
        'contacts self',
        { sessionKey: GROUP, runId },
        `owner-${(callCount += 1)}`
      );

    it.each([
      ['to another ship', withOwner('~nec'), false],
      [
        'with the owner unchanged',
        withOwner('~zod', { dmAllowlist: ['~bus'] }),
        true,
      ],
    ])(
      'revokes a running owner-directed run when the owner changes: %s',
      async (_label, reloaded, stillOwner) => {
        const { beforeToolCall, reloadConfig } = registerEntry(
          withOwner('~zod')
        );
        inbound('owner', 'run-1');
        const ctx = { sessionKey: GROUP, runId: 'run-1' };
        await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toBeUndefined();

        reloadConfig(reloaded);
        // Demoted like a run a non-owner message reached: the ex-owner's run
        // keeps no owner-only tools, tlon included.
        await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(
          stillOwner
            ? undefined
            : {
                block: true,
                blockReason: formatOwnerOnlyToolBlockReason('tlon'),
              }
        );
        // Records only move toward the bot: restoring the owner does not
        // restore the run.
        reloadConfig(withOwner('~zod'));
        await expect(beforeToolCall(TLON_CALL, ctx)).resolves.toEqual(
          stillOwner
            ? undefined
            : {
                block: true,
                blockReason: formatOwnerOnlyToolBlockReason('tlon'),
              }
        );
      }
    );

    it.each([
      ['to another ship', withOwner('~nec'), '~nec'],
      [
        'with the owner unchanged',
        withOwner('~zod', { dmAllowlist: ['~bus'] }),
        '~zod',
      ],
    ])(
      'runs the next owner-directed call as the live owner: %s',
      async (_label, reloaded, expectedOwner) => {
        const { beforeToolCall, reloadConfig, tlonTool } = registerEntry(
          withOwner('~zod')
        );
        const before = tlonTool();
        inbound('owner', 'run-0');
        expect(await actsAs({ beforeToolCall }, before, 'run-0')).toContain(
          'owner credentials for ~zod'
        );

        reloadConfig(reloaded);
        inbound('owner', 'run-1');
        await expect(
          beforeToolCall(TLON_CALL, { sessionKey: GROUP, runId: 'run-1' })
        ).resolves.toBeUndefined();
        for (const tool of [before, tlonTool()]) {
          const text = await actsAs({ beforeToolCall }, tool, 'run-1');
          expect(text).toContain(`owner credentials for ${expectedOwner}`);
          if (expectedOwner !== '~zod') expect(text).not.toContain('~zod');
        }
      }
    );
  });

  describe("the executor runs on the gate's approval for that call", () => {
    const withOwner = (ownerShip: string, ownerDefault = true) => ({
      channels: { tlon: { ownerDefault, ownerShip } },
    });
    const CHANGED =
      "Error: the bot's owner configuration changed while this command was pending; nothing was run. Run it again.";

    it.each([
      ['the owner changes', withOwner('~zod'), withOwner('~nec')],
      ['the flag turns on', withOwner('~zod', false), withOwner('~zod')],
      ['the flag turns off', withOwner('~zod'), withOwner('~zod', false)],
    ])(
      'refuses a call when %s between the gate and the executor',
      async (_label, initial, reloaded) => {
        const harness = registerEntry(initial);
        // Registration itself may call the CLI; only the tlon call counts.
        vi.mocked(runTlonCommand).mockClear();
        inbound('owner', 'run-1');
        const text = await callTlon(
          harness,
          harness.tlonTool(),
          'activity mute ~zod/g',
          { sessionKey: GROUP, runId: 'run-1' },
          'call-1',
          () => harness.reloadConfig(reloaded)
        );
        expect(text).toBe(CHANGED);
        expect(runTlonCommand).not.toHaveBeenCalled();
      }
    );

    it('runs the call on the approved config when nothing changed', async () => {
      const harness = registerEntry(withOwner('~zod'));
      inbound('owner', 'run-1');
      const text = await callTlon(
        harness,
        harness.tlonTool(),
        'contacts self',
        { sessionKey: GROUP, runId: 'run-1' },
        'call-1',
        () => harness.reloadConfig(withOwner('~zod'))
      );
      expect(text).toContain('owner credentials for ~zod');
    });

    it('takes each approval once', async () => {
      const harness = registerEntry(withOwner('~zod'));
      inbound('owner', 'run-1');
      const tool = harness.tlonTool();
      await callTlon(
        harness,
        tool,
        'contacts self',
        {
          sessionKey: GROUP,
          runId: 'run-1',
        },
        'call-1'
      );
      // A replay of the same call id without the gate runs as the bot.
      await tool!.execute('call-1', { command: 'contacts self' });
      expect(ranArgs()).toEqual(['contacts', 'self']);
    });

    it.each([
      ['no gate call at all', undefined],
      ['a gate call for another command', 'contacts list'],
    ])(
      'acts as the bot, with credential flags rejected, for %s',
      async (_label, gatedCommand) => {
        const harness = registerEntry(withOwner('~zod', false));
        inbound('owner', 'run-1');
        const tool = harness.tlonTool();
        if (gatedCommand) {
          await harness.beforeToolCall(
            {
              toolName: 'tlon',
              params: { command: gatedCommand },
              toolCallId: 'call-1',
            },
            { sessionKey: GROUP, runId: 'run-1' }
          );
        }
        vi.mocked(runTlonCommand).mockClear();
        await tool!.execute('call-1', { command: 'contacts self' });
        expect(ranArgs()).toEqual(['contacts', 'self']);
        // A legacy owner operation, owner when approved, has no owner here.
        const legacy = await tool!.execute('call-1', {
          command: 'activity mute ~zod/g',
        });
        expect(legacy.content[0].text).toContain('no owner ship is configured');
        expect(runTlonCommand).toHaveBeenCalledTimes(1);
        const refused = await tool!.execute('call-2', {
          command: '--config /x.json contacts self',
        });
        expect(refused.content[0].text).toContain(
          'credential flags (--config, --ship, --url, --code, --cookie) are not accepted'
        );
        const help = await tool!.execute('call-3', { command: 'help' });
        expect(help.content[0].text).toContain('Commands act as this bot.');
        expect(help.content[0].text).not.toContain('Owner or bot:');
      }
    );
  });

  describe('a run demoted between the gate and the executor', () => {
    const OWNER = {
      channels: { tlon: { ownerDefault: true, ownerShip: '~zod' } },
    };
    const LOST =
      'Error: this run lost owner identity while the command was pending; nothing was run. Run it again.';
    const ctx = { sessionKey: GROUP, runId: 'run-1' };
    // A provisioned owner, so an owner call reaches the CLI.
    let skillDir: string;
    beforeEach(() => {
      skillDir = mkdtempSync(join(tmpdir(), 'tlon-skill-'));
      mkdirSync(join(skillDir, 'ships'));
      writeFileSync(join(skillDir, 'ships', 'zod.json'), '{}');
      vi.stubEnv('TLON_SKILL_DIR', skillDir);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      rmSync(skillDir, { recursive: true, force: true });
    });

    it.each([
      ['a non-owner inbound message', () => inbound('user', 'run-2')],
      [
        'a sessions_send into its session',
        () => noteCrossSessionSend({ sessionKey: GROUP }, 'sender'),
      ],
    ])('refuses an owner call after %s', async (_label, demote) => {
      const harness = registerEntry(OWNER);
      vi.mocked(runTlonCommand).mockClear();
      inbound('owner', 'run-1');
      const text = await callTlon(
        harness,
        harness.tlonTool(),
        'contacts self',
        ctx,
        'call-1',
        demote
      );
      expect(text).toBe(LOST);
      expect(runTlonCommand).not.toHaveBeenCalled();
    });

    it('runs an unchanged owner run as the owner', async () => {
      const harness = registerEntry(OWNER);
      vi.mocked(runTlonCommand).mockClear();
      inbound('owner', 'run-1');
      await callTlon(harness, harness.tlonTool(), 'contacts self', ctx, 'c-1');
      expect(ranArgs()).toEqual(['--ship', '~zod', 'contacts', 'self']);
    });

    it('runs a call the gate already sent as the bot', async () => {
      const harness = registerEntry(OWNER);
      vi.mocked(runTlonCommand).mockClear();
      const cron = { sessionKey: 'agent:main:cron:j:run:1', runId: 'cron-1' };
      await harness.prepare({}, { ...cron, trigger: 'cron', jobId: 'j' });
      await callTlon(
        harness,
        harness.tlonTool(),
        'contacts self',
        cron,
        'c-1',
        () => noteCrossSessionSend({ sessionKey: cron.sessionKey }, 'sender')
      );
      expect(ranArgs()).toEqual(['contacts', 'self']);
    });

    it("runs an owner run's --self call after a demotion", async () => {
      const harness = registerEntry(OWNER);
      vi.mocked(runTlonCommand).mockClear();
      inbound('owner', 'run-1');
      await callTlon(
        harness,
        harness.tlonTool(),
        '--self contacts self',
        ctx,
        'c-1',
        () => inbound('user', 'run-2')
      );
      expect(ranArgs()).toEqual(['contacts', 'self']);
    });
  });

  describe('ownerDefault without an ownerShip', () => {
    const OWNERLESS = { channels: { tlon: { ownerDefault: true } } };
    const WARNING =
      '[tlon] ownerDefault is enabled but no ownerShip is configured; commands run as the bot.';

    it('behaves like the flag off and warns once', async () => {
      const warn = vi.fn();
      const harness = registerEntry(OWNERLESS, warn);
      vi.mocked(runTlonCommand).mockClear();
      const tool = harness.tlonTool();
      expect(tool!.description).toContain('Commands act as this bot.');
      expect(tool!.description).not.toContain('Commands act as your owner');
      inbound('owner', 'run-1');
      const ctx = { sessionKey: GROUP, runId: 'run-1' };
      // No --self rewrite: the bot is already the default.
      await expect(
        harness.beforeToolCall(TLON_CALL, ctx)
      ).resolves.toBeUndefined();
      await callTlon(harness, tool, 'contacts self', ctx, 'c-1');
      expect(ranArgs()).toEqual(['contacts', 'self']);
      // The legacy owner operations still need an owner, as with the flag off.
      const legacy = await callTlon(
        harness,
        tool,
        'activity mute ~zod/g',
        ctx,
        'c-2'
      );
      expect(legacy).toContain('no owner ship is configured');
      expect(runTlonCommand).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls.filter(([m]) => m === WARNING)).toHaveLength(1);
    });

    it('warns again after a reload that sets an owner and clears it', async () => {
      const warn = vi.fn();
      const harness = registerEntry(OWNERLESS, warn);
      harness.tlonTool();
      harness.reloadConfig({
        channels: { tlon: { ownerDefault: true, ownerShip: '~zod' } },
      });
      expect(harness.tlonTool()!.description).toContain(
        'Commands act as your owner by default'
      );
      harness.reloadConfig(OWNERLESS);
      harness.tlonTool();
      expect(warn.mock.calls.filter(([m]) => m === WARNING)).toHaveLength(2);
    });
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
