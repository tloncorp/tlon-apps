import { afterEach, expect, it, vi } from 'vitest';
import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

import {
  BACKGROUND_STATUS_TEXT,
  COMMENTARY_MAX_CHARS,
  type ComputingPresenceReporter,
  createComputingPresenceTracker,
} from './monitor/computing-presence.js';
import { createSubagentPresence } from './subagent-presence.js';

vi.mock('@tloncorp/api', () => ({}));
vi.mock('./urbit/api-client.js', () => ({
  captureTlonApiScope: () => undefined,
}));

type Event = Parameters<
  Parameters<PluginRuntime['events']['onAgentEvent']>[0]
>[0];
type Child = { runId: string; key: string };

// Run IDs, session keys and result details are from the spawn probes on
// OpenClaw 2026.9.4 (V1 visible group, V2 visible DM, V3 hidden group, V4
// nested visible).
const NEST = 'chat/~zod/tdd08ac5f0-general';
const DM = '~ten';
const V1 = {
  parent: 'fbfdeac5-00c9-41db-bf64-55572632db5a',
  child: {
    runId: '3f00a3f6-f866-4352-b9da-90e6a1082532',
    key: 'agent:test:dashboard:7fa86cf0-2d7d-4931-8308-e9fbdc498464',
  },
};
const V2 = {
  parent: '4e7ccf11-72d7-4d30-be95-0bc24021f1df',
  child: {
    runId: '3f63bd24-fe64-404e-a35b-976b34a2776e',
    key: 'agent:test:dashboard:ef68fa04-8764-47ce-965f-302d6beeb6c5',
  },
};
const V3 = {
  parent: '69a9d1a9-593d-479f-8f43-a28d41584257',
  child: {
    runId: '99c8c9c9-57d8-4b2a-b3b0-4d5e4538ea0c',
    key: 'agent:test:subagent:27999386-4d0e-469a-8083-5b251d032778',
  },
};
const V4 = {
  parent: '05633f9e-fc8c-4d4d-835e-9ed20cb0d54f',
  child: {
    runId: 'b0ea7018-35d1-4c81-90d4-a6afead516a8',
    key: 'agent:test:dashboard:c477a151-5194-4a28-8920-3f81519264f8',
  },
  grandchild: {
    runId: 'e432be59-c648-41bc-8ea6-c0511a2ff4aa',
    key: 'agent:test:dashboard:4e8cb289-2454-4911-b049-3271d10346a8',
  },
};
const FALLBACK = BACKGROUND_STATUS_TEXT;

function child(name: string): Child {
  return { runId: name, key: `agent:test:dashboard:${name}` };
}

function visible({ runId, key }: Child): Record<string, unknown> {
  return {
    status: 'accepted',
    childSessionKey: key,
    runId,
    mode: 'run',
    cleanup: 'keep',
    owner: { type: 'agent', id: 'test', label: 'Test Bot' },
  };
}

function hidden({ runId, key }: Child): Record<string, unknown> {
  return {
    status: 'accepted',
    childSessionKey: key,
    runId,
    mode: 'run',
    expectsCompletionMessage: true,
    context: 'isolated',
    resolvedModel: 'custom-proxy/tlon-test-scripted',
    modelApplied: true,
  };
}

const END_OK = {
  phase: 'end',
  stopReason: 'stop',
  livenessState: 'working',
  aborted: false,
};
const YIELD = {
  phase: 'end',
  stopReason: 'end_turn',
  livenessState: 'paused',
  yielded: true,
};

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

function harness({
  showCommentary = true,
  presence: override,
}: {
  showCommentary?: boolean;
  presence?: Partial<ReturnType<typeof createComputingPresenceTracker>>;
} = {}) {
  vi.useFakeTimers();
  const listeners = new Set<(event: Event) => void>();
  const publish = vi.fn<ComputingPresenceReporter['publish']>(async () => {});
  const presence = {
    ...createComputingPresenceTracker({
      reporter: { publish },
      minUpdateIntervalMs: 0,
    }),
    ...override,
  };
  const warn = vi.fn();
  const instance = createSubagentPresence({
    events: {
      onAgentEvent: (listener: (event: Event) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as Pick<PluginRuntime['events'], 'onAgentEvent'>,
    presence,
    showCommentary,
    warn,
  });
  cleanups.push(instance.stop);

  const emit = (event: Omit<Event, 'seq' | 'ts'>) => {
    for (const listener of listeners)
      listener({ seq: 1, ts: Date.now(), ...event } as Event);
  };
  // Tool events carry no session key on the stream. `result` is the
  // sanitized tool result, as core emits it.
  const toolResult = (
    callingRunId: string,
    details: Record<string, unknown>,
    { name = 'sessions_spawn', isError = false } = {}
  ) =>
    emit({
      runId: callingRunId,
      stream: 'tool',
      data: {
        phase: 'result',
        name,
        toolCallId: 'call_e457b730ea404184a039fb685fd9314d',
        isError,
        commandBearing: false,
        result: {
          content: [{ type: 'text', text: JSON.stringify(details) }],
          details,
        },
      },
    });
  const lifecycle = ({ runId, key }: Child, data: Event['data']) =>
    emit({ runId, sessionKey: key, stream: 'lifecycle', data });
  const start = (run: Child) => lifecycle(run, { phase: 'start' });
  const end = (run: Child) => lifecycle(run, END_OK);
  const say = ({ runId, key }: Child, progressText: string, extra = {}) =>
    emit({
      runId,
      sessionKey: key,
      stream: 'item',
      data: { phase: 'update', kind: 'preamble', progressText, ...extra },
    });
  // A turn the monitor dispatches: it spawns a child and yields.
  const turnSpawns = (
    turnRunId: string,
    conversationId: string,
    details: Record<string, unknown>
  ) => {
    instance.noteTurnStart(turnRunId, conversationId);
    toolResult(turnRunId, details);
    instance.noteTurnEnd(turnRunId);
  };
  const published = () => publish.mock.calls.map(([params]) => params);
  const last = (conversationId: string) =>
    published()
      .filter((params) => params.conversationId === conversationId)
      .at(-1);
  // The row text the reporter derives from the last published state.
  const shown = (conversationId: string) => {
    const state = last(conversationId);
    if (!state?.thinking) return null;
    return state.commentary ?? (state.background ? FALLBACK : null);
  };
  const expectNothing = () => {
    expect(publish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  };
  const expectCleared = (conversationId: string) => {
    expect(last(conversationId)?.thinking).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  };

  return {
    instance,
    presence,
    publish,
    warn,
    listeners,
    emit,
    toolResult,
    lifecycle,
    start,
    end,
    say,
    turnSpawns,
    published,
    last,
    shown,
    expectNothing,
    expectCleared,
  };
}

it.each([
  ['a visible spawn from a group turn', V1, NEST, visible(V1.child)],
  ['a hidden spawn from a group turn', V3, NEST, hidden(V3.child)],
  [
    "a visible spawn from a DM turn, in the sender's DM",
    V2,
    DM,
    visible(V2.child),
  ],
])(
  "shows %s from the child's first event until it ends",
  async (_name, run, conversationId, details) => {
    const h = harness();
    h.turnSpawns(run.parent, conversationId, details);
    await flush();
    h.expectNothing();

    h.start(run.child);
    await flush();
    expect(h.published()).toEqual([
      {
        conversationId,
        thinking: true,
        toolNames: [],
        commentary: null,
        background: true,
      },
    ]);

    h.end(run.child);
    await flush();
    h.expectCleared(conversationId);
  }
);

it.each([
  ['a lifecycle error', { phase: 'error', error: 'Agent run failed' }],
  [
    'an aborted run',
    { phase: 'end', status: 'cancelled', aborted: true, stopReason: 'aborted' },
  ],
  [
    'a timed-out run',
    { phase: 'error', stopReason: 'timeout', timeoutPhase: 'model' },
  ],
])('clears the row on %s', async (_name, data) => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);

  h.lifecycle(V1.child, data);
  await flush();
  h.expectCleared(NEST);
});

it('shows the row when a child queued behind a full lane starts minutes later', async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  h.expectNothing();

  // Commentary in the first event is not lost.
  h.say(V1.child, 'first words');
  await flush();
  expect(h.shown(NEST)).toBe('In the background: first words');
});

it('gives no row and leaves no timer for a child that never emits an event', async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  await vi.advanceTimersByTimeAsync(60 * 60_000);
  h.expectNothing();
});

it.each([
  ['its first event is lifecycle end', false, END_OK],
  ['its first event is lifecycle error', false, { phase: 'error' }],
  ['it ended before its spawn result arrived', true, END_OK],
])('gives no row to a child when %s', async (_name, endsFirst, data) => {
  const h = harness();
  if (endsFirst) {
    h.start(V1.child);
    h.lifecycle(V1.child, data);
  }
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  if (!endsFirst) h.lifecycle(V1.child, data);
  // A straggling event under the same run ID does not revive it.
  h.say(V1.child, 'late text');
  await flush();
  h.expectNothing();
});

it('shows the row as soon as the spawn result arrives for a child that already started', async () => {
  const h = harness();
  h.start(V1.child);
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
});

it.each([
  [
    "another tool's accepted result",
    // sessions_send also answers `accepted` with a run ID.
    { runId: V1.child.runId, status: 'accepted', targetDisposition: 'queued' },
    { name: 'sessions_send' },
  ],
  ['a result marked isError', visible(V1.child), { isError: true }],
  ['a forbidden status', { status: 'forbidden', error: 'not allowed' }, {}],
  [
    'a failure that still carries both IDs',
    { ...visible(V1.child), status: 'error' },
    {},
  ],
  [
    'an accepted result with no run ID',
    { ...visible(V1.child), runId: '' },
    {},
  ],
  [
    // Only the deferred collector launch returns `sessionKey`.
    'a collector spawn',
    { ...hidden(V1.child), sessionKey: V1.child.key },
    {},
  ],
])('tracks nothing for %s', async (_name, details, options) => {
  const h = harness();
  h.instance.noteTurnStart(V1.parent, NEST);
  h.toolResult(V1.parent, details, options);
  h.start(V1.child);
  h.say(V1.child, 'v1 child commentary one');
  await flush();
  h.expectNothing();
});

it.each([
  ['a calling run that is neither a live turn nor tracked', async () => {}],
  [
    'a turn after noteTurnEnd, even when its run ID is reused',
    async (h: ReturnType<typeof harness>) => {
      const first = child('first');
      h.turnSpawns(V1.parent, NEST, visible(first));
      h.start(first);
      h.end(first);
      await flush();
      h.publish.mockClear();
    },
  ],
])('does not vouch for %s', async (_name, seed) => {
  const h = harness();
  await seed(h);
  h.toolResult(V1.parent, visible(V1.child));
  h.start(V1.child);
  h.say(V1.child, 'v1 child commentary one');
  await flush();
  h.expectNothing();
});

it('shows nothing for later runs of a finished child, nor for what they spawn (private follow-up regression)', async () => {
  const h = harness();
  const c = { runId: '147f85ab', key: 'agent:test:subagent:a3f15da8' };
  h.turnSpawns(V1.parent, NEST, hidden(c));
  h.start(c);
  h.end(c);
  await flush();
  h.publish.mockClear();

  // The owner privately sends C more work from a live DM turn: a new run of
  // C that no spawn result named.
  const later = { runId: '4870212b', key: c.key };
  const grandchild = child('grandchild');
  h.instance.noteTurnStart('dm-turn', DM);
  h.start(later);
  h.say(later, 'Reading the private notes.');
  h.toolResult(later.runId, hidden(grandchild));
  h.start(grandchild);
  h.say(grandchild, 'Summarizing the private notes.');
  h.end(later);
  await flush();
  h.expectNothing();
});

it("shows a grandchild spawned by a tracked child; the child's yield clears only its own row", async () => {
  const h = harness();
  h.turnSpawns(V4.parent, NEST, visible(V4.child));
  // The child's first event is its own spawn result, so the child must be
  // shown before that event is handled.
  h.toolResult(V4.child.runId, visible(V4.grandchild));
  h.lifecycle(V4.child, YIELD);
  h.start(V4.grandchild);
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
  expect(vi.getTimerCount()).toBe(1);

  h.end(V4.grandchild);
  await flush();
  h.expectCleared(NEST);

  // The child's wake-up run was never named by a spawn result.
  h.publish.mockClear();
  const wake = {
    runId: `announce:requester-settle:test:${V4.child.key}:${V4.grandchild.runId}:yield-1`,
    key: V4.child.key,
  };
  h.start(wake);
  h.say(wake, 'v4 child woken commentary');
  await flush();
  h.expectNothing();
});

it('ignores a spawn result for a child that is already pending, shown or ended', async () => {
  const h = harness();
  h.instance.noteTurnStart(V1.parent, NEST);
  h.instance.noteTurnStart(V2.parent, DM);
  h.toolResult(V1.parent, visible(V1.child));
  h.toolResult(V2.parent, visible(V1.child));
  h.start(V1.child);
  h.toolResult(V2.parent, visible(V1.child));
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
  expect(h.last(DM)).toBeUndefined();
  expect(vi.getTimerCount()).toBe(1);

  h.end(V1.child);
  h.toolResult(V1.parent, visible(V1.child));
  h.say(V1.child, 'late text');
  await flush();
  h.expectCleared(NEST);
});

it('forgets the oldest pending spawns and early lifecycle records', async () => {
  const h = harness();
  const flood = (prefix: string, act: (run: Child) => void) => {
    for (let i = 0; i < 256; i++) act(child(`${prefix}-${i}`));
  };
  h.instance.noteTurnStart(V1.parent, NEST);

  // A forgotten pending spawn never shows a row.
  const pendingRun = child('pending');
  h.toolResult(V1.parent, visible(pendingRun));
  flood('spawn', (run) => h.toolResult(V1.parent, visible(run)));
  h.start(pendingRun);
  await flush();
  h.expectNothing();

  // A forgotten early end no longer stops a spawn result from waiting.
  const endedRun = child('ended');
  h.start(endedRun);
  h.end(endedRun);
  flood('other', (run) => h.end(run));
  h.toolResult(V1.parent, visible(endedRun));
  h.say(endedRun, 'late text');
  await flush();
  expect(h.shown(NEST)).toBe('In the background: late text');
});

it('prefixes commentary inside the length limit and drops what it should not show', async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  h.say(V1.child, 'v1 child commentary one');
  await flush();
  expect(h.shown(NEST)).toBe('In the background: v1 child commentary one');

  // A doubled snapshot is dropped.
  h.say(V1.child, 'v1 child commentary onev1 child commentary one');
  await flush();
  expect(h.shown(NEST)).toBe('In the background: v1 child commentary one');

  h.say(V1.child, 'word '.repeat(40).trim());
  await flush();
  const text = h.shown(NEST) ?? '';
  expect(text.startsWith('In the background: word')).toBe(true);
  expect(text.endsWith('…')).toBe(true);
  expect(Array.from(text).length).toBeLessThanOrEqual(COMMENTARY_MAX_CHARS);

  // Text that formats to nothing restores the fallback.
  h.say(V1.child, '[[reply_to_current]]');
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);

  h.say(V1.child, 'Hidden.', { hideFromChannelProgress: true });
  h.say({ runId: '99260224', key: V1.child.key }, 'Untracked run text.');
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
});

it('shows only the fallback text when showCommentary is off', async () => {
  const h = harness({ showCommentary: false });
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  h.say(V1.child, 'v1 child commentary one');
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
  expect(h.published().some((params) => params.commentary !== null)).toBe(
    false
  );
});

it("keeps a child's commentary when a silent sibling starts, and each sibling's end keeps the other's row", async () => {
  const h = harness();
  const a = child('a');
  const b = { runId: 'b', key: 'agent:test:subagent:b' };
  h.instance.noteTurnStart(V1.parent, NEST);
  h.toolResult(V1.parent, visible(a));
  h.toolResult(V1.parent, hidden(b));
  h.instance.noteTurnEnd(V1.parent);

  h.say(a, 'Checking documents');
  await flush();
  h.start(b);
  await flush();
  expect(h.shown(NEST)).toBe('In the background: Checking documents');

  h.say(a, '  ');
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);

  h.end(b);
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
  h.end(a);
  await flush();
  h.expectCleared(NEST);
});

it('refreshes a long run with the heartbeat and clears it after 30 minutes of silence, logging once', async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  await flush();
  const publishes = h.publish.mock.calls.length;

  await vi.advanceTimersByTimeAsync(30 * 60_000 - 20_000);
  // The tracker republishes unchanged state only when asked after 30s.
  expect(h.publish.mock.calls.length).toBeGreaterThan(publishes);
  expect(h.shown(NEST)).toBe(FALLBACK);

  await vi.advanceTimersByTimeAsync(20_000);
  h.expectCleared(NEST);
  await vi.advanceTimersByTimeAsync(60 * 60_000);
  expect(h.warn).toHaveBeenCalledTimes(1);
});

it('keeps the row for a run that keeps emitting events past 30 minutes', async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    h.emit({
      runId: V1.child.runId,
      stream: 'tool',
      data: { phase: 'start', name: 'read' },
    });
  }
  await flush();
  expect(h.shown(NEST)).toBe(FALLBACK);
  expect(h.warn).not.toHaveBeenCalled();
});

it.each([
  [
    'showing a row',
    'refreshRun',
    (h: ReturnType<typeof harness>) => h.start(V1.child),
  ],
  [
    'ending a row',
    'stopRun',
    (h: ReturnType<typeof harness>) => {
      h.start(V1.child);
      h.end(V1.child);
    },
  ],
] as const)(
  'reports a failure while %s through warn, without throwing or leaving a heartbeat',
  async (_name, method, act) => {
    const h = harness({
      presence: {
        [method]: () => {
          throw new Error('boom');
        },
      },
    });
    h.turnSpawns(V1.parent, NEST, visible(V1.child));
    expect(() => act(h)).not.toThrow();
    expect(h.warn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it('stop() clears every row and unsubscribes', async () => {
  const h = harness();
  h.turnSpawns(V2.parent, DM, visible(V2.child));
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V2.child);
  h.start(V1.child);
  await flush();
  expect(vi.getTimerCount()).toBe(2);

  h.instance.stop();
  await flush();
  expect(h.last(DM)?.thinking).toBe(false);
  h.expectCleared(NEST);
  expect(h.listeners.size).toBe(0);
});

it('keeps each conversation’s commentary in that conversation across every publication', async () => {
  const h = harness();
  h.turnSpawns(V2.parent, DM, visible(V2.child));
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V2.child);
  h.start(V1.child);
  h.say(V2.child, 'DM-MARKER reading the DM');
  await flush();
  h.say(V1.child, 'GROUP-MARKER reading the channel');
  await flush();
  h.say(V2.child, 'DM-MARKER still reading');
  await flush();
  h.end(V2.child);
  await flush();
  expect(h.last(DM)?.thinking).toBe(false);
  expect(h.shown(NEST)).toBe(
    'In the background: GROUP-MARKER reading the channel'
  );

  for (const [marker, conversationId] of [
    ['DM-MARKER', DM],
    ['GROUP-MARKER', NEST],
  ]) {
    const carrying = h
      .published()
      .filter((params) => params.commentary?.includes(marker));
    expect(carrying.length).toBeGreaterThan(0);
    expect(carrying.every((p) => p.conversationId === conversationId)).toBe(
      true
    );
  }
});

it("gives way to the main agent's own state in the same conversation", async () => {
  const h = harness();
  h.turnSpawns(V1.parent, NEST, visible(V1.child));
  h.start(V1.child);
  h.presence.refreshRun({ conversationId: NEST, runId: 'main' });
  await flush();
  expect(h.last(NEST)).toEqual({
    conversationId: NEST,
    thinking: true,
    toolNames: [],
    commentary: null,
  });

  h.say(V1.child, 'Child text.');
  h.presence.setCommentary({
    conversationId: NEST,
    runId: 'main',
    text: 'Answering you now.',
  });
  await flush();
  expect(h.shown(NEST)).toBe('Answering you now.');

  h.presence.stopRun({ conversationId: NEST, runId: 'main' });
  await flush();
  expect(h.shown(NEST)).toBe('In the background: Child text.');
});
