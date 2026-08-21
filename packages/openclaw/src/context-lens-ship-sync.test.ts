import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  type ContextLensEvent,
  publishContextLensEvent,
} from './context-lens-events.js';
import {
  buildLensRunPayload,
  createContextLensShipSync,
  initContextLensShipSync,
  isContextLensEffectivelyEnabled,
  isDurableActivityMilestone,
  resolveLensOwner,
} from './context-lens-ship-sync.js';
import { type ContextLens, createContextLensRegistry } from './context-lens.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';

function makeLens(overrides: Partial<ContextLens> = {}): ContextLens {
  const registry = createContextLensRegistry({ ttlMs: 60_000 });
  const lens = registry.create({
    messageId: 'msg-1',
    chatType: 'dm',
    trigger: 'dm',
  });
  return { ...lens, ...overrides };
}

function makeEvent(
  lens: ContextLens,
  detail?: ContextLensEvent['detail']
): ContextLensEvent {
  return {
    seq: 1,
    at: Date.now(),
    phase: 'status',
    lens,
    ...(detail ? { detail } : {}),
  };
}

type RecordedPoke = { app: string; mark: string; json: unknown };

function makeParams(pokes: RecordedPoke[]): SharedApiClientParams {
  return {
    poke: (params) => {
      pokes.push(params as RecordedPoke);
      return Promise.resolve(undefined);
    },
  };
}

const silentLogger = { info: () => {}, warn: () => {} };

// configure rides the core %steward-action-1 mark; lens run milestones and
// finals ride the per-module %steward-lens-action-1 mark.
const pokeKind = (p: RecordedPoke): 'configure' | 'lens' =>
  p.mark === 'steward-action-1' ? 'configure' : 'lens';

describe('resolveLensOwner', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('normalizes the configured owner', () => {
    expect(
      resolveLensOwner(makeConfig({ contextLens: { owner: 'bus' } }))
    ).toEqual('~bus');
  });

  it('falls back to ownerShip when owner is unset', () => {
    expect(
      resolveLensOwner(makeConfig({ ownerShip: 'dev', contextLens: {} }))
    ).toEqual('~dev');
    expect(resolveLensOwner(makeConfig({ contextLens: {} }))).toBeNull();
  });
});

describe('isContextLensEffectivelyEnabled', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('is enabled for ship-sync-only configs (owners, no authToken)', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ contextLens: { enabled: true, owner: '~bus' } })
      )
    ).toBe(true);
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ ownerShip: 'dev', contextLens: { enabled: true } })
      )
    ).toBe(true);
  });

  it('is enabled for routes-only configs (authToken, no owners)', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({
          contextLens: {
            enabled: true,
            authToken: 'a-token-of-sufficient-length',
          },
        })
      )
    ).toBe(true);
  });

  it('is disabled without any consumer or when not enabled', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ contextLens: { enabled: true } })
      )
    ).toBe(false);
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({
          contextLens: {
            enabled: false,
            authToken: 'a-token-of-sufficient-length',
            owner: '~bus',
          },
        })
      )
    ).toBe(false);
  });
});

describe('buildLensRunPayload', () => {
  it('serializes the lens with a schemaVersion', () => {
    const lens = makeLens();
    const payload = buildLensRunPayload(lens);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.lens.lensId).toBe(lens.lensId);
  });

  it('truncates oversized tool summaries', () => {
    const lens = makeLens();
    lens.tools.runs = [
      {
        id: 't-1',
        callIndex: 1,
        name: 'browser',
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMs: 5,
        status: 'completed',
        argumentSummary: 'x'.repeat(10_000),
        resultSummary: 'ok',
      },
    ];
    const payload = buildLensRunPayload(lens);
    const run = payload.lens.tools.runs[0];
    expect(run.argumentSummary?.length).toBeLessThan(5_000);
    expect(run.argumentSummary).toContain('[truncated]');
    expect(run.resultSummary).toBe('ok');
  });

  it('drops bulky arrays when the payload exceeds the total cap', () => {
    const lens = makeLens();
    lens.tools.runs = Array.from({ length: 100 }, (_, i) => ({
      id: `t-${i}`,
      callIndex: i + 1,
      name: 'browser',
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 5,
      status: 'completed' as const,
      argumentSummary: 'y'.repeat(4_000),
    }));
    const payload = buildLensRunPayload(lens);
    expect(payload.truncated).toBe(true);
    expect(payload.lens.tools.runs).toEqual([]);
    expect(payload.lens.status).toBe(lens.status);
    expect(JSON.stringify(payload).length).toBeLessThan(50 * 1_024);
  });

  it('drops retained activity items when they would exceed the ship payload cap', () => {
    const lens = makeLens();
    lens.activity.items = Array.from({ length: 80 }, (_, index) => ({
      id: `commentary-${index}`,
      kind: 'commentary' as const,
      title: `Progress ${index}`,
      status: 'completed' as const,
      startedAt: index,
      updatedAt: index + 1,
      completedAt: index + 1,
      progressText: 'x'.repeat(2_000),
    }));
    lens.activity.eventCount = 80;

    const payload = buildLensRunPayload(lens);

    expect(payload.truncated).toBe(true);
    expect(payload.lens.activity.items).toEqual([]);
    expect(payload.lens.activity.eventCount).toBe(80);
    expect(payload.lens.activity.truncated).toBe(true);
    expect(JSON.stringify(payload).length).toBeLessThan(50 * 1_024);
  });

  it('includes retrySeed in the run payload and keeps retryOf', () => {
    const lens = makeLens();
    lens.retryOf = 'lens-original';
    lens.retrySeed = {
      messageText: 'secret original message body',
      blobField: '{"k":"v"}',
    };
    const payload = buildLensRunPayload(lens);
    expect(payload.lens.retrySeed).toEqual({
      messageText: 'secret original message body',
      blobField: '{"k":"v"}',
    });
    expect(payload.lens.retryOf).toBe('lens-original');
    expect(JSON.stringify(payload)).toContain('secret original message body');
  });

  it('keeps retrySeed when oversized payloads are skeletonized', () => {
    const registry = createContextLensRegistry({ ttlMs: 60_000 });
    const blobField = JSON.stringify({ body: 'b'.repeat(7_500) });
    const lens = registry.create({
      messageId: 'msg-oversized-retry',
      chatType: 'channel',
      trigger: 'mention',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      retrySeed: {
        messageText: 'm'.repeat(20_000),
        blobField,
        parentId: '170.1',
        isThreadReply: true,
        replyParentId: '170.2',
        cachesHistory: true,
      },
    });
    lens.tools.runs = Array.from({ length: 100 }, (_, i) => ({
      id: `t-${i}`,
      callIndex: i + 1,
      name: 'browser',
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 5,
      status: 'completed' as const,
      argumentSummary: 'y'.repeat(4_000),
      resultSummary: 'z'.repeat(4_000),
    }));

    const payload = buildLensRunPayload(lens);

    expect(payload.truncated).toBe(true);
    expect(payload.lens.tools.runs).toEqual([]);
    expect(payload.lens.context.sources).toEqual([]);
    expect(payload.lens.outputs).toEqual([]);
    expect(payload.lens.retrySeed).toEqual(lens.retrySeed);
    expect(payload.lens.retrySeed?.messageText).toHaveLength(16_384);
    expect(payload.lens.retrySeed?.blobField).toBe(blobField);
    expect(JSON.stringify(payload).length).toBeLessThan(50 * 1_024);
  });
});

describe('isDurableActivityMilestone', () => {
  const activity = (
    overrides: Partial<NonNullable<ContextLensEvent['detail']>['activity']> = {}
  ): NonNullable<NonNullable<ContextLensEvent['detail']>['activity']> => ({
    schemaVersion: 1,
    runId: 'run-1',
    sequence: 1,
    occurredAt: 1_000,
    kind: 'item',
    phase: 'update',
    retention: 'snapshot',
    status: 'running',
    ...overrides,
  });

  it('keeps plan and bounded work-state transitions ship-visible', () => {
    expect(isDurableActivityMilestone(activity({ kind: 'plan' }))).toBe(true);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'commentary', status: 'running' })
      )
    ).toBe(true);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'tool', phase: 'result', status: 'completed' })
      )
    ).toBe(true);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'approval', status: 'waiting' })
      )
    ).toBe(true);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'request_input', status: 'waiting' })
      )
    ).toBe(true);
  });

  it('keeps ephemeral and unknown deltas off the ship milestone path', () => {
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'commentary', status: 'unknown' })
      )
    ).toBe(false);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'command', retention: 'ephemeral' })
      )
    ).toBe(false);
    expect(
      isDurableActivityMilestone(
        activity({ kind: 'item', title: 'Reasoning', progressText: undefined })
      )
    ).toBe(false);
    expect(
      isDurableActivityMilestone(
        activity({
          kind: 'item',
          title: undefined,
          progressText: undefined,
          source: 'codex-app-server-completion',
        })
      )
    ).toBe(false);
    expect(
      isDurableActivityMilestone(
        activity({
          kind: 'item',
          title: 'Reasoning',
          progressText: 'Checking the current profile',
        })
      )
    ).toBe(true);
  });
});

describe('createContextLensShipSync', () => {
  it('configures owners once, then pokes run milestones and finals', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    const lens = makeLens({ status: 'dispatching' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent({ ...lens, status: 'tool_running' }));
    sync.handleEvent(makeEvent({ ...lens, status: 'completed' }));
    await sync.flush();

    // The terminal cancels the live debounce window, so no older partial
    // snapshot gets ahead of the coherent final snapshot.
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
    expect(pokes.every((p) => p.app === 'steward')).toBe(true);
    expect(pokes[0].mark).toBe('steward-action-1');
    expect(pokes[0].json).toEqual({ configure: { owner: '~bus' } });
    expect(
      pokes.slice(1).every((p) => p.mark === 'steward-lens-action-1')
    ).toBe(true);
    const final = pokes[1].json as {
      entry: { id: string; payload: unknown; final: boolean };
    };
    expect(final.entry.id).toBe(lens.lensId);
    expect(final.entry.final).toBe(true);
  });

  it('pokes bounded live activity transitions without forwarding duplicates', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });
    const lens = makeLens({ status: 'dispatching' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(
      makeEvent(lens, {
        activity: {
          schemaVersion: 1,
          runId: 'run-1',
          sequence: 1,
          occurredAt: 1_000,
          kind: 'commentary',
          phase: 'update',
          retention: 'snapshot',
          itemId: 'commentary-1',
          status: 'running',
          progressText: 'Still inspecting',
        },
      })
    );
    sync.handleEvent(
      makeEvent(lens, {
        activity: {
          schemaVersion: 1,
          runId: 'run-1',
          sequence: 2,
          occurredAt: 1_050,
          kind: 'commentary',
          phase: 'update',
          retention: 'snapshot',
          itemId: 'commentary-1',
          status: 'running',
          progressText: 'A repeated live delta',
        },
      })
    );
    sync.handleEvent(
      makeEvent(lens, {
        activity: {
          schemaVersion: 1,
          runId: 'run-1',
          sequence: 3,
          occurredAt: 1_100,
          kind: 'plan',
          phase: 'update',
          retention: 'snapshot',
          plan: { steps: [], updatedAt: 1_100 },
        },
      })
    );
    await sync.flush();

    // Flush promotes only the latest snapshot from the live debounce window.
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
  });

  it('flushes a staged live snapshot and waits for its poke to settle', async () => {
    const pokes: RecordedPoke[] = [];
    let releaseLensPoke: (() => void) | undefined;
    const params: SharedApiClientParams = {
      poke: (params) => {
        const poke = params as RecordedPoke;
        pokes.push(poke);
        if (pokeKind(poke) === 'lens') {
          return new Promise<void>((resolve) => {
            releaseLensPoke = resolve;
          });
        }
        return Promise.resolve(undefined);
      },
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    };
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    sync.handleEvent(makeEvent(makeLens({ status: 'tool_running' })));
    let didFlush = false;
    const flushing = sync.flush().then(() => {
      didFlush = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
    expect(didFlush).toBe(false);
    expect(releaseLensPoke).toBeTypeOf('function');

    releaseLensPoke?.();
    await flushing;
    expect(didFlush).toBe(true);
  });

  it('coalesces a burst of live milestones into one bounded partial poke', async () => {
    vi.useFakeTimers();
    try {
      const pokes: RecordedPoke[] = [];
      const params = makeParams(pokes);
      const sync = createContextLensShipSync({
        owner: '~bus',
        logger: silentLogger,
        getParams: () => params,
      });
      const lens = makeLens({ status: 'tool_running' });

      for (let index = 0; index < 100; index += 1) {
        sync.handleEvent(
          makeEvent(
            { ...lens, updatedAt: index + 1 },
            {
              activity: {
                schemaVersion: 1,
                runId: 'run-1',
                sequence: index + 1,
                occurredAt: index + 1,
                kind: 'tool',
                phase: 'result',
                retention: 'snapshot',
                itemId: `tool-${index}`,
                status: 'completed',
              },
            }
          )
        );
      }

      expect(pokes).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(249);
      expect(pokes).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await sync.flush();

      const lensPokes = pokes.filter((poke) => pokeKind(poke) === 'lens');
      expect(lensPokes).toHaveLength(1);
      const partial = lensPokes[0].json as {
        entry: {
          final: boolean;
          payload: { lens: { updatedAt: number } };
        };
      };
      expect(partial.entry.final).toBe(false);
      expect(partial.entry.payload.lens.updatedAt).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a live debounce and sends the terminal snapshot immediately', async () => {
    vi.useFakeTimers();
    try {
      const pokes: RecordedPoke[] = [];
      const params = makeParams(pokes);
      const sync = createContextLensShipSync({
        owner: '~bus',
        logger: silentLogger,
        getParams: () => params,
      });
      const lens = makeLens({ status: 'tool_running' });

      for (let index = 0; index < 40; index += 1) {
        sync.handleEvent(
          makeEvent(
            { ...lens, updatedAt: index + 1 },
            {
              activity: {
                schemaVersion: 1,
                runId: 'run-1',
                sequence: index + 1,
                occurredAt: index + 1,
                kind: 'tool',
                phase: 'result',
                retention: 'snapshot',
                itemId: `tool-${index}`,
                status: 'completed',
              },
            }
          )
        );
      }
      sync.handleEvent(
        makeEvent({ ...lens, status: 'completed', updatedAt: 100 })
      );
      await sync.flush();

      const lensPokes = pokes.filter((poke) => pokeKind(poke) === 'lens');
      expect(lensPokes).toHaveLength(1);
      expect(
        (lensPokes[0].json as { entry: { final: boolean } }).entry.final
      ).toBe(true);

      await vi.advanceTimersByTimeAsync(250);
      expect(pokes.filter((poke) => pokeKind(poke) === 'lens')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps independent live runs fair within the same debounce window', async () => {
    vi.useFakeTimers();
    try {
      const pokes: RecordedPoke[] = [];
      const params = makeParams(pokes);
      const sync = createContextLensShipSync({
        owner: '~bus',
        logger: silentLogger,
        getParams: () => params,
      });
      const first = makeLens({ lensId: 'lens-first', status: 'tool_running' });
      const second = makeLens({
        lensId: 'lens-second',
        status: 'tool_running',
      });

      sync.handleEvent(makeEvent(first));
      sync.handleEvent(makeEvent(second));
      for (let index = 0; index < 20; index += 1) {
        sync.handleEvent(
          makeEvent(
            { ...first, updatedAt: index + 1 },
            {
              activity: {
                schemaVersion: 1,
                runId: 'run-first',
                sequence: index + 1,
                occurredAt: index + 1,
                kind: 'tool',
                phase: 'result',
                retention: 'snapshot',
                itemId: `tool-${index}`,
                status: 'completed',
              },
            }
          )
        );
      }

      await vi.advanceTimersByTimeAsync(250);
      await sync.flush();
      const ids = pokes
        .filter((poke) => pokeKind(poke) === 'lens')
        .map((poke) => (poke.json as { entry: { id: string } }).entry.id);
      expect(ids).toEqual(['lens-first', 'lens-second']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a terminal snapshot preempt a backlog of live milestones', async () => {
    const pokes: RecordedPoke[] = [];
    let releaseFirstLensPoke: (() => void) | undefined;
    let lensPokeCount = 0;
    const params: SharedApiClientParams = {
      poke: (params) => {
        const poke = params as RecordedPoke;
        pokes.push(poke);
        if (pokeKind(poke) === 'lens' && lensPokeCount++ === 0) {
          return new Promise<void>((resolve) => {
            releaseFirstLensPoke = resolve;
          });
        }
        return Promise.resolve(undefined);
      },
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    };
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
      nonterminalDebounceMs: 0,
    });
    const lens = makeLens({ status: 'dispatching' });

    sync.handleEvent(makeEvent(lens));
    await Promise.resolve();
    await Promise.resolve();
    expect(releaseFirstLensPoke).toBeTypeOf('function');

    for (let index = 0; index < 40; index += 1) {
      sync.handleEvent(
        makeEvent(
          { ...lens, status: 'tool_running', updatedAt: index + 2 },
          {
            activity: {
              schemaVersion: 1,
              runId: 'run-1',
              sequence: index + 1,
              occurredAt: index + 1,
              kind: 'tool',
              phase: 'update',
              retention: 'snapshot',
              itemId: `tool-${index}`,
              status: 'completed',
            },
          }
        )
      );
    }
    sync.handleEvent(
      makeEvent({ ...lens, status: 'completed', updatedAt: 100 })
    );
    releaseFirstLensPoke?.();
    await sync.flush();

    const lensPokes = pokes.filter((poke) => pokeKind(poke) === 'lens');
    expect(lensPokes).toHaveLength(2);
    const final = lensPokes[1].json as {
      entry: {
        final: boolean;
        payload: { lens: { status: ContextLens['status'] } };
      };
    };
    expect(final.entry.final).toBe(true);
    expect(final.entry.payload.lens.status).toBe('completed');
  });

  it('skips repeat events with an unchanged status', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    const lens = makeLens({ status: 'tool_running' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent(lens));
    await sync.flush();

    expect(pokes).toHaveLength(2); // configure + one lens poke
  });

  it('ignores internal-visibility runs', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    sync.handleEvent(
      makeEvent(makeLens({ visibility: 'internal', status: 'completed' }))
    );
    await sync.flush();

    expect(pokes).toHaveLength(0);
  });

  it('drops events while no api params are published, without buffering', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    let connected = false;
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => (connected ? params : null),
    });

    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes).toHaveLength(0);

    connected = true;
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
  });

  it('retries transient poke failures and re-configures on params change', async () => {
    const pokes: RecordedPoke[] = [];
    let fail = true;
    const flaky: SharedApiClientParams = {
      poke: (params) => {
        if (fail) {
          fail = false;
          return Promise.reject(new Error('ship offline'));
        }
        pokes.push(params as RecordedPoke);
        return Promise.resolve(undefined);
      },
    };
    let current = flaky;
    const warnings: string[] = [];
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
      getParams: () => current,
      retryDelaysMs: [0, 0],
    });

    // The first configure failure is retried in place, preserving this final.
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(warnings).toHaveLength(0);
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);

    // New params instance (monitor restart): configure re-asserted.
    current = makeParams(pokes);
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map(pokeKind)).toEqual([
      'configure',
      'lens',
      'configure',
      'lens',
    ]);
  });

  it('retries a transient lens poke without dropping the run', async () => {
    const pokes: RecordedPoke[] = [];
    let failLensOnce = true;
    const params: SharedApiClientParams = {
      poke: (params) => {
        const poke = params as RecordedPoke;
        if (pokeKind(poke) === 'lens' && failLensOnce) {
          failLensOnce = false;
          return Promise.reject(new Error('fetch failed'));
        }
        pokes.push(poke);
        return Promise.resolve(undefined);
      },
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    };
    const warnings: string[] = [];
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
      getParams: () => params,
      retryDelaysMs: [0, 0],
    });

    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();

    expect(warnings).toHaveLength(0);
    expect(pokes.map(pokeKind)).toEqual(['configure', 'configure', 'lens']);
  });
});

// Keep this block last: initContextLensShipSync subscribes to the global lens
// event stream, and the final subscription persists for the rest of the file.
describe('initContextLensShipSync', () => {
  it('replaces the event subscription on re-init instead of stacking pokes', async () => {
    const pokes: RecordedPoke[] = [];
    const slot = sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT);
    const previousParams = slot.get();
    slot.set(makeParams(pokes));
    const api = {
      config: {
        channels: {
          tlon: {
            ship: '~zod',
            contextLens: {
              enabled: true,
              authToken: 'a-token-of-sufficient-length',
              owner: '~bus',
            },
          },
        },
      } as OpenClawConfig,
      logger: silentLogger,
    };

    try {
      expect(initContextLensShipSync(api)).toBe(true);
      expect(initContextLensShipSync(api)).toBe(true);

      publishContextLensEvent('final', makeLens({ status: 'completed' }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
    } finally {
      slot.set(previousParams);
    }
  });
});
