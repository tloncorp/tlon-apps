import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordInboundSession } from 'openclaw/plugin-sdk/conversation-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { ResolvedAgentRoute } from 'openclaw/plugin-sdk/routing';
import { getSessionEntry } from 'openclaw/plugin-sdk/session-store-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTlonInboundRouteRecord,
  recordTlonRouteAndDispatch,
} from './session-routing.js';

// Proves the durable route written by buildTlonInboundRouteRecord + the real
// SDK `recordInboundSession` lands under `lastRouteSessionKey` where the
// SQLite-backed delivery consumer reads it — i.e. a later route-dependent send
// resolves Tlon instead of falling back to webchat.

function makeRoute(
  overrides: Partial<ResolvedAgentRoute> = {}
): ResolvedAgentRoute {
  return {
    agentId: 'default',
    channel: 'tlon',
    accountId: 'default',
    sessionKey: 'agent:default:main',
    mainSessionKey: 'agent:default:main',
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
  vi.stubEnv('OPENCLAW_STATE_DIR', dir);
  storePath = join(dir, 'agents', 'default', 'agent', 'openclaw-agent.sqlite');
  mkdirSync(join(dir, 'agents', 'default', 'agent'), { recursive: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function readEntry(sessionKey: string) {
  return getSessionEntry({
    agentId: 'default',
    storePath,
    sessionKey,
    readConsistency: 'latest',
  });
}

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

    const entry = readEntry(record.lastRouteSessionKey);
    expect(entry).toBeDefined();
    expect(entry?.delivery?.route.channel).toBe('tlon');
    expect(entry?.delivery?.route.target.to).toBe('tlon:~zod');
    expect(entry?.delivery?.context.channel).toBe('tlon');
    expect(entry?.delivery?.context.to).toBe('tlon:~zod');
  });

  it('persists a group/channel route under a session-specific key', async () => {
    const record = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute({
        sessionKey: 'agent:default:tlon:group:chat/~host/general',
        lastRoutePolicy: 'session',
      }),
      isGroup: true,
      groupChannel: 'chat/~host/general',
      senderShip: '~nec',
    });

    await persist(record);

    const entry = readEntry(record.lastRouteSessionKey);
    expect(entry).toBeDefined();
    expect(entry?.delivery?.route.channel).toBe('tlon');
    expect(entry?.delivery?.route.target.to).toBe('tlon:chat/~host/general');
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
      readEntry(threaded.lastRouteSessionKey)?.delivery?.route.thread?.id
    ).toBe('thread-1');

    const unthreaded = buildTlonInboundRouteRecord({
      cfg,
      route: makeRoute(),
      isGroup: false,
      senderShip: '~zod',
    });
    await persist(unthreaded);
    expect(
      readEntry(unthreaded.lastRouteSessionKey)?.delivery?.route.thread
    ).toBeUndefined();
  });

  it('full kernel path: the durable route is readable from the store before dispatch runs', async () => {
    // This is the webchat-leak regression: a route-dependent send that happens
    // during dispatch must observe the persisted route.
    const tasks: Array<Promise<unknown>> = [];
    let lastToAtDispatch: string | undefined;

    const result = await recordTlonRouteAndDispatch({
      session: {
        recordInboundSession: (p) =>
          recordInboundSession({
            ...p,
            trackSessionMetaTask: (task) => tasks.push(task),
          }),
        resolveStorePath: () => storePath,
      },
      cfg,
      route: makeRoute(),
      ctxPayload: {
        SessionKey: 'agent:default:main',
        Provider: 'tlon',
        OriginatingChannel: 'tlon',
        OriginatingTo: 'tlon:~zod',
        ChatType: 'direct',
        SenderId: '~zod',
      } as never,
      ctxSessionKey: 'agent:default:main',
      isGroup: false,
      senderShip: '~zod',
      dispatch: async () => {
        lastToAtDispatch =
          readEntry('agent:default:main')?.delivery?.context.to;
        return 'dispatched';
      },
    });
    await Promise.all(tasks);

    expect(result).toBe('dispatched');
    expect(lastToAtDispatch).toBe('tlon:~zod');
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
    expect(readEntry(owner.lastRouteSessionKey)?.delivery?.context.to).toBe(
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
    expect(readEntry(intruder.lastRouteSessionKey)?.delivery?.context.to).toBe(
      'tlon:~zod'
    );
    expect(skips).toEqual([
      { ownerRecipient: '~zod', senderRecipient: '~nec' },
    ]);
  });
});
