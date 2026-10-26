import { afterEach, describe, expect, it, vi } from 'vitest';

import { runBrowserSessionHandoff } from './browser-session-handoff.js';
import { runBrowserHandoffCommand } from './tlon-command-runner.js';
import { mcpReadOnlyPolicyTesting } from './mcp-readonly-policy.js';

/**
 * A turn that cannot borrow the gateway's plugin instance loads a separate
 * one in discovery mode: a fresh module evaluation that runs only
 * registerCapabilities. Its agent-turn hooks must still see the deps the
 * gateway's registerFull computed, or cron attribution never happens there and
 * the onboarding cron's MCP restriction is never applied. Two module
 * instances are simulated with vi.resetModules().
 */

vi.mock('./monitor/agent-onboarding.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./monitor/agent-onboarding.js')>();
  return { ...actual, isAgentOnboardingCronJob: vi.fn(async () => false) };
});

vi.mock('./browser-session-handoff.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./browser-session-handoff.js')>();
  return {
    ...actual,
    runBrowserSessionHandoff: vi.fn().mockResolvedValue('Card sent'),
  };
});
vi.mock('./tlon-command-runner.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./tlon-command-runner.js')>();
  return {
    ...actual,
    runBrowserHandoffCommand: vi.fn().mockResolvedValue('Card sent'),
  };
});
const handoffRecords = new Map<string, unknown>();
const walletRecords = new Map<string, unknown>();

type Handler = (...args: unknown[]) => Promise<unknown>;

/** Proxy api whose every unknown member is a no-op returning the proxy. */
function createApi(registrationMode: string): {
  api: unknown;
  hooks: Map<string, Handler>;
} {
  const hooks = new Map<string, Handler>();
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') return registrationMode;
      if (prop === 'config') return {};
      if (prop === 'runtime')
        return new Proxy(
          {},
          {
            get(_runtime, key) {
              return key === 'config' ? { current: () => ({}) } : proxy;
            },
          }
        );
      if (prop === 'openKeyedStore')
        return ({ namespace }: { namespace: string }) => {
          const rows =
            namespace === 'wallet-handoffs' ? walletRecords : handoffRecords;
          return {
            lookup: async (key: string) => rows.get(key),
            register: async (key: string, value: unknown) => {
              rows.set(key, value);
            },
            registerIfAbsent: async (key: string, value: unknown) => {
              if (rows.has(key)) return false;
              rows.set(key, value);
              return true;
            },
          };
        };
      if (prop === 'getSessionEntry')
        return () => ({ sessionId: 'conversation-1' });
      if (prop === 'on') {
        return (name: string, handler: Handler) => {
          hooks.set(name, handler);
        };
      }
      if (prop === 'toString' || prop === 'valueOf') {
        return () => '[shared-deps-api]';
      }
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return proxy;
    },
    apply: () => proxy,
  });
  return { api: proxy, hooks };
}

const SESSION = 'agent:main:cron:onboarding';

afterEach(() => {
  mcpReadOnlyPolicyTesting.clear();
  handoffRecords.clear();
  walletRecords.clear();
  vi.mocked(runBrowserHandoffCommand).mockClear();
  vi.mocked(runBrowserSessionHandoff).mockClear();
});

describe('agent-turn hook deps across plugin module instances', () => {
  it('a discovery-mode instance attributes cron turns with the gateway instance deps', async () => {
    const gatewayModule = await import('../index.js');
    gatewayModule.default.register(createApi('full').api as never);

    vi.resetModules();
    const turnModule = await import('../index.js');
    expect(turnModule).not.toBe(gatewayModule);
    const turn = createApi('discovery');
    turnModule.default.register(turn.api as never);

    await turn.hooks.get('agent_turn_prepare')!(
      {},
      { trigger: 'cron', jobId: 'onboarding-job', sessionKey: SESSION }
    );

    // The turn instance's own policy module reads the shared attribution.
    const turnPolicy = await import('./mcp-readonly-policy.js');
    expect(turnPolicy.cronJobForSession(SESSION)).toBe('onboarding-job');

    // ...and its before_tool_call checks the job for the onboarding MCP
    // restriction instead of treating the turn as unattributed.
    const turnOnboarding = await import('./monitor/agent-onboarding.js');
    await turn.hooks.get('before_tool_call')!(
      { toolName: 'mcp__describe', params: {} },
      { sessionKey: SESSION }
    );
    expect(turnOnboarding.isAgentOnboardingCronJob).toHaveBeenCalledWith(
      'onboarding-job'
    );
  });
});

describe('browser hooks across plugin registration modes', () => {
  it.each(['full', 'discovery', 'tool-discovery'])(
    'keeps the gateway lock and approval lifecycle in %s turns',
    async (mode) => {
      handoffRecords.clear();
      vi.mocked(runBrowserSessionHandoff).mockClear();
      const gatewayModule = await import('../index.js');
      const gateway = createApi('full');
      gatewayModule.default.register(gateway.api as never);
      let turn = gateway;
      if (mode !== 'full') {
        vi.resetModules();
        const turnModule = await import('../index.js');
        expect(turnModule).not.toBe(gatewayModule);
        turn = createApi(mode);
        turnModule.default.register(turn.api as never);
      }
      const ctx = {
        sessionKey: 'agent:main:tlon:direct:~ten',
        runId: 'browser-turn',
      };
      const roles = await import('./session-roles.js');
      roles.setSessionRole(ctx.sessionKey, 'owner');
      handoffRecords.set('test-browser', { id: 'pending-fill' });
      await expect(
        turn.hooks.get('before_tool_call')!(
          {
            toolName: 'mcp__call',
            params: {
              name: 'browser_browser_act',
              arguments: { session_id: 'test-browser' },
            },
          },
          ctx
        )
      ).resolves.toMatchObject({
        block: true,
        blockReason: expect.stringContaining('waiting for secure entry'),
      });
      handoffRecords.clear();
      const event = {
        toolName: 'mcp__call',
        params: {
          name: 'browser_browser_login',
          arguments: { session_id: 'test-browser', fields: ['@e12'] },
        },
        result: {
          details: {
            structuredContent: {
              session_id: 'test-browser',
              login: { status: 'approval_required' },
            },
          },
        },
      };
      await turn.hooks.get('after_tool_call')!(event, ctx);
      // A second registry must not send the same approval twice.
      await gateway.hooks.get('after_tool_call')!(event, ctx);
      expect(runBrowserSessionHandoff).toHaveBeenCalledTimes(1);
      expect(runBrowserSessionHandoff).toHaveBeenCalledWith(
        expect.any(String),
        [
          'browser',
          'approve-login',
          'test-browser',
          '--fields',
          JSON.stringify(['@e12']),
        ],
        {},
        expect.any(Function)
      );
      await turn.hooks.get('agent_end')!(
        { messages: [], success: true, durationMs: 1 },
        ctx
      );
      await turn.hooks.get('after_tool_call')!(event, ctx);
      expect(runBrowserSessionHandoff).toHaveBeenCalledTimes(2);
      const requestId = '11111111-1111-4111-8111-111111111111';
      const walletEvent = {
        toolName: 'mcp__call',
        params: { name: 'browser_payment_request' },
        result: {
          details: {
            structuredContent: {
              request_id: requestId,
              owner_action_required: true,
              expires_at: Date.now() + 600000,
            },
          },
        },
      };
      await turn.hooks.get('after_tool_call')!(walletEvent, ctx);
      await gateway.hooks.get('after_tool_call')!(walletEvent, ctx);
      expect(runBrowserHandoffCommand).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        ['browser', 'wallet', requestId],
        {}
      );
      expect(walletRecords.get(requestId)).toMatchObject({
        sessionKey: ctx.sessionKey,
        sessionId: 'conversation-1',
        sent: true,
      });
    }
  );
});
