import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('agent-turn hook deps across plugin module instances', () => {
  afterEach(() => {
    mcpReadOnlyPolicyTesting.clear();
  });

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
