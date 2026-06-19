import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { ResolvedAgentRoute } from 'openclaw/plugin-sdk/routing';
import { describe, expect, it, vi } from 'vitest';

import {
  type TlonInboundRouteInput,
  buildTlonInboundRouteRecord,
  recordRouteThenDispatch,
  recordTlonInboundRoute,
  recordTlonRouteAndDispatch,
  routeUpdateWillSkipByPin,
  tlonDeliveryContext,
} from './session-routing.js';

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

function cfgWithDmScope(dmScope?: string): OpenClawConfig {
  return { session: dmScope ? { dmScope } : {} } as unknown as OpenClawConfig;
}

function dmInput(
  overrides: Partial<TlonInboundRouteInput> = {}
): TlonInboundRouteInput {
  return {
    cfg: cfgWithDmScope('main'),
    route: makeRoute(),
    isGroup: false,
    senderShip: '~zod',
    ...overrides,
  };
}

function groupInput(
  overrides: Partial<TlonInboundRouteInput> = {}
): TlonInboundRouteInput {
  return {
    cfg: cfgWithDmScope('main'),
    // group peers resolve to a session-specific route, not the main session
    route: makeRoute({
      sessionKey: 'tlon:group:chat/~host/general',
      lastRoutePolicy: 'session',
    }),
    isGroup: true,
    groupChannel: 'chat/~host/general',
    senderShip: '~nec',
    ...overrides,
  };
}

describe('buildTlonInboundRouteRecord — DM', () => {
  it('records channel tlon, provider-qualified to, and no thread id', () => {
    const r = buildTlonInboundRouteRecord(dmInput({ senderShip: '~zod' }));
    expect(r.target).toBe('tlon:~zod');
    expect(r.updateLastRoute?.channel).toBe('tlon');
    expect(r.updateLastRoute?.to).toBe('tlon:~zod');
    expect(r.updateLastRoute?.threadId).toBeUndefined();
  });

  it('records threadId from deliverParentId', () => {
    const r = buildTlonInboundRouteRecord(dmInput({ deliverParentId: '123' }));
    expect(r.updateLastRoute?.threadId).toBe('123');
  });

  it('records threadId from parentId when no deliverParentId', () => {
    const r = buildTlonInboundRouteRecord(dmInput({ parentId: '456' }));
    expect(r.updateLastRoute?.threadId).toBe('456');
  });

  it('omits threadId for an unthreaded DM (lets SDK clear stale thread state)', () => {
    const r = buildTlonInboundRouteRecord(dmInput());
    expect(r.updateLastRoute).toBeDefined();
    expect('threadId' in (r.updateLastRoute ?? {})).toBe(false);
  });

  it('writes updateLastRoute.sessionKey as lastRouteSessionKey even when it differs from recordSessionKey', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({
        route: makeRoute({
          sessionKey: 'tlon:peer',
          mainSessionKey: 'tlon:main',
          lastRoutePolicy: 'main',
        }),
        ctxSessionKey: 'tlon:ctx',
      })
    );
    // policy 'main' => last-route key collapses to mainSessionKey
    expect(r.lastRouteSessionKey).toBe('tlon:main');
    expect(r.recordSessionKey).toBe('tlon:ctx');
    expect(r.updateLastRoute?.sessionKey).toBe('tlon:main');
  });
});

describe('buildTlonInboundRouteRecord — DM main-session pinning', () => {
  it('pins the configured owner against a different sender', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~nec', effectiveOwnerShip: '~zod' })
    );
    expect(r.updateLastRoute?.mainDmOwnerPin).toEqual({
      ownerRecipient: '~zod',
      senderRecipient: '~nec',
    });
  });

  it('prefers the configured owner over a single allowlist entry', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({
        senderShip: '~nec',
        effectiveOwnerShip: '~zod',
        effectiveDmAllowlist: ['~bus'],
      })
    );
    expect(r.updateLastRoute?.mainDmOwnerPin?.ownerRecipient).toBe('~zod');
  });

  it('pins a single-owner allowlist when no owner is configured', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~nec', effectiveDmAllowlist: ['~bus'] })
    );
    expect(r.updateLastRoute?.mainDmOwnerPin?.ownerRecipient).toBe('~bus');
  });

  it('does not pin a wildcard allowlist', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~nec', effectiveDmAllowlist: ['*'] })
    );
    expect(r.updateLastRoute?.mainDmOwnerPin).toBeUndefined();
  });

  it('does not pin a multi-entry allowlist with no configured owner', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~nec', effectiveDmAllowlist: ['~bus', '~rch'] })
    );
    expect(r.updateLastRoute?.mainDmOwnerPin).toBeUndefined();
  });

  it('does not pin an isolated per-channel-peer session', () => {
    const r = buildTlonInboundRouteRecord(
      dmInput({
        cfg: cfgWithDmScope('per-channel-peer'),
        route: makeRoute({
          sessionKey: 'tlon:peer:~nec',
          mainSessionKey: 'tlon:main',
          lastRoutePolicy: 'session',
        }),
        senderShip: '~nec',
        effectiveOwnerShip: '~zod',
      })
    );
    expect(r.updateLastRoute).toBeDefined();
    expect(r.updateLastRoute?.sessionKey).toBe('tlon:peer:~nec');
    expect(r.updateLastRoute?.mainDmOwnerPin).toBeUndefined();
  });
});

describe('buildTlonInboundRouteRecord — group/channel', () => {
  it('records a provider-qualified channel nest target for a session-specific route', () => {
    const r = buildTlonInboundRouteRecord(groupInput());
    expect(r.target).toBe('tlon:chat/~host/general');
    expect(r.updateLastRoute?.to).toBe('tlon:chat/~host/general');
    expect(r.updateLastRoute?.sessionKey).toBe('tlon:group:chat/~host/general');
  });

  it('records group thread id from deliverParentId ?? parentId', () => {
    const r = buildTlonInboundRouteRecord(groupInput({ parentId: 't1' }));
    expect(r.updateLastRoute?.threadId).toBe('t1');
  });

  it('skips updateLastRoute (but not origin metadata) when groupChannel is missing', () => {
    const r = buildTlonInboundRouteRecord(
      groupInput({ groupChannel: undefined })
    );
    expect(r.updateLastRoute).toBeUndefined();
    expect(r.target).toBeNull();
    expect(r.skippedReason).toBe('group-missing-channel');
  });

  it('skips updateLastRoute when the group route resolves to the main session', () => {
    const r = buildTlonInboundRouteRecord(
      groupInput({
        route: makeRoute({
          sessionKey: 'tlon:main',
          mainSessionKey: 'tlon:main',
          lastRoutePolicy: 'main',
        }),
      })
    );
    expect(r.updateLastRoute).toBeUndefined();
    expect(r.target).toBe('tlon:chat/~host/general');
    expect(r.skippedReason).toBe('group-route-targets-main-session');
  });

  it('skips updateLastRoute for a malformed group nest', () => {
    const r = buildTlonInboundRouteRecord(
      groupInput({ groupChannel: 'not-a-valid-nest' })
    );
    expect(r.updateLastRoute).toBeUndefined();
    expect(r.target).toBeNull();
    expect(r.skippedReason).toBe('group-invalid-channel');
  });

  it('canonicalizes the group nest before storing it', () => {
    const r = buildTlonInboundRouteRecord(
      groupInput({ groupChannel: 'CHAT/~ZOD/General' })
    );
    expect(r.updateLastRoute?.to).toBe('tlon:chat/~zod/General');
  });
});

describe('recordTlonInboundRoute', () => {
  it('records under recordSessionKey with the durable route under lastRouteSessionKey', async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const record = buildTlonInboundRouteRecord(
      dmInput({
        route: makeRoute({
          sessionKey: 'tlon:peer',
          mainSessionKey: 'tlon:main',
          lastRoutePolicy: 'main',
        }),
        ctxSessionKey: 'tlon:ctx',
        senderShip: '~zod',
      })
    );

    await recordTlonInboundRoute({
      session: { recordInboundSession },
      storePath: '/tmp/store.json',
      ctxPayload: { SessionKey: 'tlon:ctx' },
      record,
    });

    expect(recordInboundSession).toHaveBeenCalledTimes(1);
    const arg = recordInboundSession.mock.calls[0][0];
    expect(arg.sessionKey).toBe('tlon:ctx');
    expect(arg.updateLastRoute.sessionKey).toBe('tlon:main');
    expect(arg.updateLastRoute.to).toBe('tlon:~zod');
  });

  it('fails open and logs when recordInboundSession throws', async () => {
    const recordInboundSession = vi.fn().mockRejectedValue(new Error('boom'));
    const logError = vi.fn();
    const record = buildTlonInboundRouteRecord(dmInput());

    await expect(
      recordTlonInboundRoute({
        session: { recordInboundSession },
        storePath: '/tmp/store.json',
        ctxPayload: {},
        record,
        logError,
      })
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toContain(
      'failed recording inbound session route'
    );
  });

  it('records origin metadata and warns (logError) for a missing-channel group route', async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();
    const logDebug = vi.fn();
    const record = buildTlonInboundRouteRecord(
      groupInput({ groupChannel: undefined })
    );

    await recordTlonInboundRoute({
      session: { recordInboundSession },
      storePath: '/tmp/store.json',
      ctxPayload: {},
      record,
      logError,
      logDebug,
    });

    expect(recordInboundSession).toHaveBeenCalledTimes(1);
    expect(
      recordInboundSession.mock.calls[0][0].updateLastRoute
    ).toBeUndefined();
    // Anomalous case is visible outside debug; routine debug log is not used.
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toContain('group-missing-channel');
    expect(logDebug).not.toHaveBeenCalled();
  });

  it('debug-logs (logDebug, not logError) a routine main-session group skip', async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();
    const logDebug = vi.fn();
    const record = buildTlonInboundRouteRecord(
      groupInput({
        route: makeRoute({
          sessionKey: 'tlon:main',
          mainSessionKey: 'tlon:main',
          lastRoutePolicy: 'main',
        }),
      })
    );
    expect(record.skippedReason).toBe('group-route-targets-main-session');

    await recordTlonInboundRoute({
      session: { recordInboundSession },
      storePath: '/tmp/store.json',
      ctxPayload: {},
      record,
      logError,
      logDebug,
    });

    expect(logDebug).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
  });
});

describe('tlonDeliveryContext', () => {
  it('builds a Tlon delivery context for a channel nest target', () => {
    expect(tlonDeliveryContext('tlon:chat/~host/general', 'acct-1')).toEqual({
      channel: 'tlon',
      to: 'tlon:chat/~host/general',
      accountId: 'acct-1',
    });
  });

  it('omits accountId when not provided', () => {
    expect(tlonDeliveryContext('tlon:~zod')).toEqual({
      channel: 'tlon',
      to: 'tlon:~zod',
    });
  });
});

describe('routeUpdateWillSkipByPin', () => {
  it('is true when a pin owner differs from the sender', () => {
    const record = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~nec', effectiveOwnerShip: '~zod' })
    );
    expect(routeUpdateWillSkipByPin(record.updateLastRoute)).toBe(true);
  });

  it('is false when the pinned owner is the sender', () => {
    const record = buildTlonInboundRouteRecord(
      dmInput({ senderShip: '~zod', effectiveOwnerShip: '~zod' })
    );
    expect(routeUpdateWillSkipByPin(record.updateLastRoute)).toBe(false);
  });

  it('is false when there is no pin', () => {
    const record = buildTlonInboundRouteRecord(dmInput({ senderShip: '~zod' }));
    expect(routeUpdateWillSkipByPin(record.updateLastRoute)).toBe(false);
    expect(routeUpdateWillSkipByPin(undefined)).toBe(false);
  });
});

describe('recordRouteThenDispatch', () => {
  it('records before dispatching and returns the dispatch result', async () => {
    const calls: string[] = [];
    const result = await recordRouteThenDispatch({
      record: async () => {
        calls.push('record');
      },
      dispatch: async () => {
        calls.push('dispatch');
        return 'dispatched';
      },
    });
    expect(calls).toEqual(['record', 'dispatch']);
    expect(result).toBe('dispatched');
  });

  it('does not dispatch if the record step rejects', async () => {
    const dispatch = vi.fn();
    await expect(
      recordRouteThenDispatch({
        record: async () => {
          throw new Error('record failed');
        },
        dispatch,
      })
    ).rejects.toThrow('record failed');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('recordTlonRouteAndDispatch (monitor boundary)', () => {
  function mockSession() {
    const order: string[] = [];
    const recordInboundSession = vi.fn().mockImplementation(async () => {
      order.push('record');
    });
    const resolveStorePath = vi.fn().mockReturnValue('/tmp/store.json');
    return { order, recordInboundSession, resolveStorePath };
  }

  it('records the route before dispatching for a DM', async () => {
    const { order, recordInboundSession, resolveStorePath } = mockSession();
    const dispatch = vi.fn().mockImplementation(async () => {
      order.push('dispatch');
      return 'ok';
    });

    const result = await recordTlonRouteAndDispatch({
      session: { recordInboundSession, resolveStorePath },
      cfg: cfgWithDmScope('main'),
      route: makeRoute(),
      ctxPayload: { SessionKey: 'tlon:main' } as never,
      ctxSessionKey: 'tlon:main',
      isGroup: false,
      senderShip: '~zod',
      dispatch,
    });

    expect(result).toBe('ok');
    expect(order).toEqual(['record', 'dispatch']);
    expect(recordInboundSession).toHaveBeenCalledTimes(1);
    expect(recordInboundSession.mock.calls[0][0].updateLastRoute.to).toBe(
      'tlon:~zod'
    );
  });

  it('records the route before dispatching for a group message', async () => {
    const { order, recordInboundSession, resolveStorePath } = mockSession();
    const dispatch = vi.fn().mockImplementation(async () => {
      order.push('dispatch');
    });

    await recordTlonRouteAndDispatch({
      session: { recordInboundSession, resolveStorePath },
      cfg: cfgWithDmScope('main'),
      route: makeRoute({
        sessionKey: 'tlon:group:chat/~host/general',
        lastRoutePolicy: 'session',
      }),
      ctxPayload: { SessionKey: 'tlon:group:chat/~host/general' } as never,
      ctxSessionKey: 'tlon:group:chat/~host/general',
      isGroup: true,
      groupChannel: 'chat/~host/general',
      senderShip: '~nec',
      dispatch,
    });

    expect(order).toEqual(['record', 'dispatch']);
    expect(recordInboundSession.mock.calls[0][0].updateLastRoute.to).toBe(
      'tlon:chat/~host/general'
    );
  });

  it('passes the built record to onRecord', async () => {
    const { recordInboundSession, resolveStorePath } = mockSession();
    const onRecord = vi.fn();

    await recordTlonRouteAndDispatch({
      session: { recordInboundSession, resolveStorePath },
      cfg: cfgWithDmScope('main'),
      route: makeRoute(),
      ctxPayload: {} as never,
      ctxSessionKey: 'tlon:main',
      isGroup: false,
      senderShip: '~zod',
      onRecord,
      dispatch: async () => undefined,
    });

    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord.mock.calls[0][0].target).toBe('tlon:~zod');
  });

  it('still dispatches when recording fails (fail open)', async () => {
    const recordInboundSession = vi.fn().mockRejectedValue(new Error('boom'));
    const resolveStorePath = vi.fn().mockReturnValue('/tmp/store.json');
    const dispatch = vi.fn().mockResolvedValue('ok');
    const logError = vi.fn();

    const result = await recordTlonRouteAndDispatch({
      session: { recordInboundSession, resolveStorePath },
      cfg: cfgWithDmScope('main'),
      route: makeRoute(),
      ctxPayload: {} as never,
      ctxSessionKey: 'tlon:main',
      isGroup: false,
      senderShip: '~zod',
      logError,
      dispatch,
    });

    expect(result).toBe('ok');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalled();
  });

  it('still dispatches when resolveStorePath throws (fail open)', async () => {
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const resolveStorePath = vi.fn().mockImplementation(() => {
      throw new Error('bad store config');
    });
    const dispatch = vi.fn().mockResolvedValue('ok');
    const logError = vi.fn();

    const result = await recordTlonRouteAndDispatch({
      session: { recordInboundSession, resolveStorePath },
      cfg: cfgWithDmScope('main'),
      route: makeRoute(),
      ctxPayload: {} as never,
      ctxSessionKey: 'tlon:main',
      isGroup: false,
      senderShip: '~zod',
      logError,
      dispatch,
    });

    expect(result).toBe('ok');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(recordInboundSession).not.toHaveBeenCalled();
    expect(logError.mock.calls[0][0]).toContain(
      'failed resolving session store path'
    );
  });
});
