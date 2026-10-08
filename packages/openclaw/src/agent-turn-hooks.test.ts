import { describe, expect, it, vi } from 'vitest';

import entry, { registerAgentTurnHooks } from '../index.js';
import { formatOwnerOnlyToolBlockReason } from './owner-only-tools.js';
import { setSessionRole } from './session-roles.js';

/**
 * OpenClaw 2026.9.x dispatches hooks inside an agent turn from a per-turn
 * plugin registry loaded in "discovery" registration mode, where the bundled
 * channel entry helper calls registerCapabilities but never registerFull. A
 * hook registered only from registerFull is therefore invisible to every
 * turn. These tests pin the agent-turn hooks to registerCapabilities so a
 * refactor cannot quietly move them back (which silently disabled the
 * owner-only tool gate on 2026.9.4).
 */

const AGENT_TURN_HOOKS = [
  'before_tool_call',
  'after_tool_call',
  'agent_turn_prepare',
  'model_call_started',
  'agent_end',
  'session_start',
  'session_end',
  'reply_payload_sending',
  'message_sending',
  'message_sent',
] as const;

type Registered = { name: string; handler: (...args: unknown[]) => unknown };

function makeApi(registrationMode?: string) {
  const registered: Registered[] = [];
  const api = {
    registrationMode,
    on: vi.fn((name: string, handler: Registered['handler']) => {
      registered.push({ name, handler });
    }),
    registerChannel: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {},
    runtime: {},
  };
  return { api, registered };
}

function countByName(registered: Registered[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { name } of registered) {
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

describe('registerAgentTurnHooks', () => {
  it('registers every agent-turn hook exactly once', () => {
    const { api, registered } = makeApi();
    registerAgentTurnHooks(api as never);
    const counts = countByName(registered);
    expect(Object.keys(counts).sort()).toEqual([...AGENT_TURN_HOOKS].sort());
    for (const name of AGENT_TURN_HOOKS) {
      expect(counts[name], name).toBe(1);
    }
  });

  it('blocks owner-only tools for a stored non-owner role even before registerFull ran', async () => {
    const { api, registered } = makeApi();
    registerAgentTurnHooks(api as never);
    const beforeToolCall = registered.find(
      (r) => r.name === 'before_tool_call'
    )?.handler;
    expect(beforeToolCall).toBeDefined();

    setSessionRole('agent:test:tlon:direct:~mug', 'user');
    await expect(
      beforeToolCall!(
        { toolName: 'tlon', params: { command: 'contacts get ~zod' } },
        { sessionKey: 'agent:test:tlon:direct:~mug' }
      )
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('tlon'),
    });

    setSessionRole('agent:test:tlon:direct:~ten', 'owner');
    await expect(
      beforeToolCall!(
        { toolName: 'tlon', params: { command: 'contacts get ~zod' } },
        { sessionKey: 'agent:test:tlon:direct:~ten' }
      )
    ).resolves.toBeUndefined();
  });
});

describe('plugin entry registration modes', () => {
  it('registers the agent-turn hooks from a discovery-mode registration and the gate enforces there', async () => {
    const { api, registered } = makeApi('discovery');
    entry.register(api as never);
    const counts = countByName(registered);
    for (const name of AGENT_TURN_HOOKS) {
      expect(counts[name], name).toBe(1);
    }

    // The handler the discovery-mode registry holds is the one a 2026.9.x
    // turn dispatches; it must enforce the owner-only gate on its own.
    const beforeToolCall = registered.find(
      (r) => r.name === 'before_tool_call'
    )?.handler;
    setSessionRole('agent:test:tlon:direct:~nec', 'user');
    await expect(
      beforeToolCall!(
        { toolName: 'read', params: { path: 'SOUL.md' } },
        { sessionKey: 'agent:test:tlon:direct:~nec' }
      )
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('read'),
    });
  });

  it('registers no hooks from a cli-metadata registration', () => {
    const { api, registered } = makeApi('cli-metadata');
    entry.register(api as never);
    expect(registered).toEqual([]);
  });
});
