import { describe, expect, it } from 'vitest';

import {
  type ContextLensContinuation,
  resolveRequestInputContinuation,
} from './context-lens-continuation.js';
import { type ContextLens, createContextLensRegistry } from './context-lens.js';

const BOT = '~bearclawd';
const REQUESTER = '~sitrul-nacwyl';
const CHANNEL = 'chat/~sitrul-nacwyl/general';
const THREAD = '~sitrul-nacwyl/100';
const BASE = Date.now();

function waitingLens(
  overrides: Partial<ContextLens> = {},
  options: { requestedAt?: number; threadRootId?: string | null } = {}
): ContextLens {
  const registry = createContextLensRegistry({ botShip: BOT, ttlMs: 60_000 });
  const lens = registry.create({
    messageId: '~sitrul-nacwyl/101',
    chatType: 'channel',
    trigger: 'thread',
    senderShip: REQUESTER,
    conversationId: CHANNEL,
    now: BASE,
    retrySeed: {
      messageText: 'Draft an announcement',
      parentId: options.threadRootId === null ? null : THREAD,
      isThreadReply: options.threadRootId !== null,
    },
  });
  registry.recordActivity(lens.lensId, {
    schemaVersion: 1,
    runId: 'run-parent',
    sequence: 1,
    occurredAt: options.requestedAt ?? BASE + 100,
    phase: 'requested',
    retention: 'snapshot',
    kind: 'request_input',
    itemId: 'request-input:call-1',
    title: "What's the venue?",
    status: 'waiting',
    source: 'tlon_request_input',
  });
  return { ...registry.get(lens.lensId)!, ...overrides };
}

function scope(overrides: Record<string, unknown> = {}) {
  return {
    botShip: BOT,
    requesterShip: REQUESTER,
    conversationId: CHANNEL,
    conversationKind: 'channel' as const,
    threadRootId: THREAD,
    linkedAt: BASE + 250,
    ...overrides,
  };
}

describe('request-input continuation lineage', () => {
  it('links the first subsequent post without examining its prose', () => {
    const parent = waitingLens();

    expect(resolveRequestInputContinuation([parent], scope())).toEqual({
      kind: 'request_input',
      parentLensId: parent.lensId,
      requestInputId: 'request-input:call-1',
      workflowId: parent.lensId,
      linkedAt: BASE + 250,
    });
  });

  it.each([
    ['bot', { botShip: '~other-bot' }],
    ['requester', { requesterShip: '~other-member' }],
    ['channel', { conversationId: 'chat/~sitrul-nacwyl/random' }],
    ['thread', { threadRootId: '~sitrul-nacwyl/other-thread' }],
    ['conversation kind', { conversationKind: 'dm' as const }],
    ['pre-question linkage time', { linkedAt: BASE + 99 }],
  ])('does not cross the exact %s boundary', (_label, mismatch) => {
    expect(
      resolveRequestInputContinuation([waitingLens()], scope(mismatch))
    ).toBeNull();
  });

  it('distinguishes a channel root from a thread in that channel', () => {
    const channelParent = waitingLens({}, { threadRootId: null });

    expect(
      resolveRequestInputContinuation(
        [channelParent],
        scope({ threadRootId: undefined })
      )
    ).not.toBeNull();
    expect(
      resolveRequestInputContinuation([channelParent], scope())
    ).toBeNull();
  });

  it('consumes a parent exactly once when any child carries its durable link', () => {
    const parent = waitingLens();
    const continuation = resolveRequestInputContinuation([parent], scope())!;
    const child = waitingLens({
      lensId: 'child-lens',
      continuation,
      activity: {
        schemaVersion: 1,
        eventCount: 0,
        lastEventAt: null,
        truncated: false,
        plan: null,
        items: [],
      },
    });

    expect(
      resolveRequestInputContinuation(
        [parent, child],
        scope({ linkedAt: BASE + 300 })
      )
    ).toBeNull();
  });

  it('selects the most recent exact-scope gate and preserves its workflow', () => {
    const older = waitingLens(
      { lensId: 'older-parent', createdAt: BASE - 10 },
      { requestedAt: BASE + 100 }
    );
    const inherited: ContextLensContinuation = {
      kind: 'request_input',
      parentLensId: 'workflow-root',
      requestInputId: 'old-request',
      workflowId: 'workflow-root',
      linkedAt: BASE + 110,
    };
    const newer = waitingLens(
      {
        lensId: 'newer-parent',
        createdAt: BASE + 50,
        continuation: inherited,
      },
      { requestedAt: BASE + 150 }
    );

    expect(
      resolveRequestInputContinuation([older, newer], scope())
    ).toMatchObject({
      parentLensId: 'newer-parent',
      workflowId: 'workflow-root',
    });

    const currentChild = waitingLens({
      lensId: 'current-child',
      continuation: {
        kind: 'request_input',
        parentLensId: 'newer-parent',
        requestInputId: 'request-input:call-1',
        workflowId: 'workflow-root',
        linkedAt: BASE + 250,
      },
      activity: {
        schemaVersion: 1,
        eventCount: 0,
        lastEventAt: null,
        truncated: false,
        plan: null,
        items: [],
      },
    });
    expect(
      resolveRequestInputContinuation(
        [older, newer, currentChild],
        scope({ linkedAt: BASE + 300 })
      )
    ).toBeNull();
  });
});
