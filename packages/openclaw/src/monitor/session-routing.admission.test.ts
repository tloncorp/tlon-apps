import { afterEach, describe, expect, it, vi } from 'vitest';

const runPreparedInboundReply = vi.fn();

vi.mock('openclaw/plugin-sdk/inbound-reply-dispatch', () => ({
  runPreparedInboundReply: (...args: unknown[]) =>
    runPreparedInboundReply(...args),
}));

const { recordTlonRouteAndDispatch } = await import('./session-routing.js');

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      recordInboundSession: async () => undefined,
      resolveStorePath: () => '/tmp/unused-sessions.json',
    },
    cfg: {} as never,
    route: {
      agentId: 'default',
      accountId: 'default',
      sessionKey: 'agent:default:main',
      mainSessionKey: 'agent:default:main',
      matchedBy: 'default' as const,
    } as never,
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
    dispatch: async () => 'dispatched',
    ...overrides,
  };
}

afterEach(() => {
  runPreparedInboundReply.mockReset();
});

describe('recordTlonRouteAndDispatch admission outcomes', () => {
  it('returns the dispatch result for a dispatched turn', async () => {
    runPreparedInboundReply.mockResolvedValue({
      admission: { kind: 'dispatch' },
      dispatched: true,
      dispatchResult: 'dispatched',
    });

    await expect(recordTlonRouteAndDispatch(makeParams())).resolves.toBe(
      'dispatched'
    );
  });

  it.each([
    { kind: 'drop', reason: 'outbound-echo' },
    { kind: 'drop', reason: 'bot-loop-protection' },
    { kind: 'handled', reason: 'command' },
  ])(
    'treats a non-dispatched $kind/$reason admission as a no-op, not a failure',
    async (admission) => {
      runPreparedInboundReply.mockResolvedValue({
        admission,
        dispatched: false,
      });
      const debugLines: string[] = [];
      const notDispatched: unknown[] = [];
      let dispatched = false;

      await expect(
        recordTlonRouteAndDispatch(
          makeParams({
            logDebug: (msg: string) => debugLines.push(msg),
            onNotDispatched: (a: unknown) => notDispatched.push(a),
            dispatch: async () => {
              dispatched = true;
              return 'dispatched';
            },
          })
        )
      ).resolves.toBeUndefined();

      expect(dispatched).toBe(false);
      expect(notDispatched).toEqual([admission]);
      expect(debugLines).toEqual([
        `[tlon][route-debug] inbound turn not dispatched: admission=${admission.kind} reason=${admission.reason}`,
      ]);
    }
  );

  it('stays quiet about a non-dispatched turn when route debug is off', async () => {
    runPreparedInboundReply.mockResolvedValue({
      admission: { kind: 'drop', reason: 'outbound-echo' },
      dispatched: false,
    });
    const errors: string[] = [];

    await expect(
      recordTlonRouteAndDispatch(
        makeParams({ logError: (msg: string) => errors.push(msg) })
      )
    ).resolves.toBeUndefined();
    expect(errors).toEqual([]);
  });
});
