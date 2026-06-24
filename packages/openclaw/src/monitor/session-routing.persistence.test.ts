import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSessionStore } from 'openclaw/plugin-sdk/config-runtime';
import { recordInboundSession } from 'openclaw/plugin-sdk/conversation-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { ResolvedAgentRoute } from 'openclaw/plugin-sdk/routing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildTlonInboundRouteRecord } from './session-routing.js';

// Proves the durable route written by buildTlonInboundRouteRecord + the real
// SDK `recordInboundSession` lands under `lastRouteSessionKey` where the
// delivery consumer reads it — i.e. a later route-dependent send resolves Tlon
// instead of falling back to webchat.

function makeRoute(
  overrides: Partial<ResolvedAgentRoute> = {}
): ResolvedAgentRoute {
  return {
    agentId: 'default',
    channel: 'tlon',
    accountId: 'default',
    sessionKey: 'tlon:main',
    mainSessionKey: 'tlon:main',
    lastRoutePolicy: 'main',
    matchedBy: 'default',
    ...overrides,
  };
}

const cfg = { session: { dmScope: 'main' } } as unknown as OpenClawConfig;

let dir: string;
let storePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tlon-route-'));
  storePath = join(dir, 'sessions.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function persist(record: ReturnType<typeof buildTlonInboundRouteRecord>) {
  const tasks: Array<Promise<unknown>> = [];
  const errors: unknown[] = [];
  await recordInboundSession({
    storePath,
    sessionKey: record.recordSessionKey,
    ctx: {
      SessionKey: record.recordSessionKey,
      Provider: 'tlon',
      Surface: 'tlon',
      OriginatingChannel: 'tlon',
      OriginatingTo: record.target ?? undefined,
      ChatType: 'direct',
      SenderId: '~zod',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    updateLastRoute: record.updateLastRoute,
    onRecordError: (err) => errors.push(err),
    trackSessionMetaTask: (task) => tasks.push(task),
  });
  await Promise.all(tasks);
  expect(errors).toEqual([]);
}

describe('Tlon route persistence (real SDK store)', () => {
  it('persists a DM route under lastRouteSessionKey for the consumer to resolve', async () => {
    const record = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~zod',
    });

    await persist(record);

    const entry = loadSessionStore(storePath)[record.lastRouteSessionKey];
    expect(entry).toBeDefined();
    expect(entry?.deliveryContext?.channel).toBe('tlon');
    expect(entry?.deliveryContext?.to).toBe('tlon:~zod');
    expect(entry?.lastChannel).toBe('tlon');
    expect(entry?.lastTo).toBe('tlon:~zod');
  });

  it('persists a group/channel route under a session-specific key', async () => {
    const record = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute({
        sessionKey: 'tlon:group:chat/~host/general',
        lastRoutePolicy: 'session',
      }),
      isGroup: true,
      groupChannel: 'chat/~host/general',
      senderShip: '~nec',
    });

    await persist(record);

    const entry = loadSessionStore(storePath)[record.lastRouteSessionKey];
    expect(entry).toBeDefined();
    expect(entry?.lastChannel).toBe('tlon');
    expect(entry?.lastTo).toBe('tlon:chat/~host/general');
  });

  it('clears stale thread state when a later unthreaded route is recorded', async () => {
    const threaded = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~zod',
      deliverParentId: 'thread-1',
    });
    await persist(threaded);
    expect(
      loadSessionStore(storePath)[threaded.lastRouteSessionKey]?.lastThreadId
    ).toBe('thread-1');

    const unthreaded = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~zod',
    });
    await persist(unthreaded);
    expect(
      loadSessionStore(storePath)[unthreaded.lastRouteSessionKey]?.lastThreadId
    ).toBeUndefined();
  });

  it('owner pin blocks a non-owner DM from overwriting the main route and fires onSkip', async () => {
    // Owner establishes the durable main-session route (owner === sender, no skip).
    const owner = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~zod',
      effectiveOwnerShip: '~zod',
    });
    await persist(owner);
    expect(loadSessionStore(storePath)[owner.lastRouteSessionKey]?.lastTo).toBe(
      'tlon:~zod'
    );

    // A non-owner DM resolves to the same main session but must not clobber it.
    const intruder = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~nec',
      effectiveOwnerShip: '~zod',
    });
    const update = intruder.updateLastRoute;
    if (!update?.mainDmOwnerPin) {
      throw new Error('expected a mainDmOwnerPin for a non-owner main DM');
    }

    const skips: Array<{ ownerRecipient: string; senderRecipient: string }> =
      [];
    await recordInboundSession({
      storePath,
      sessionKey: intruder.recordSessionKey,
      ctx: {
        SessionKey: intruder.recordSessionKey,
        Provider: 'tlon',
        ChatType: 'direct',
        SenderId: '~nec',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      updateLastRoute: {
        ...update,
        mainDmOwnerPin: {
          ...update.mainDmOwnerPin,
          onSkip: (p) => skips.push(p),
        },
      },
      onRecordError: (err) => {
        throw err;
      },
    });

    // Route unchanged, and the skip was observable rather than silent.
    expect(
      loadSessionStore(storePath)[intruder.lastRouteSessionKey]?.lastTo
    ).toBe('tlon:~zod');
    expect(skips).toEqual([
      { ownerRecipient: '~zod', senderRecipient: '~nec' },
    ]);
  });
});
