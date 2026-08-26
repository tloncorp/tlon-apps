import { describe, expect, it } from 'vitest';

import {
  type ContextLens,
  type ContextLensEvent,
  contextLensEventAtTime,
  contextLensEventFromStewardRun,
} from './types';

function lens(): ContextLens {
  return {
    lensId: 'lens-1',
    messageId: 'message-1',
    chatType: 'channel',
    trigger: 'mention',
    triggerDetails: {
      type: 'mention',
      messageId: 'message-1',
      conversationId: 'chat/~zod/general',
      conversationKind: 'channel',
    },
    model: null,
    provider: null,
    status: 'tool_running',
    error: null,
    createdAt: 1,
    updatedAt: 2,
    context: {
      currentMessage: true,
      threadMessages: 0,
      channelMessages: 0,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
    },
    persistence: {
      postsReply: false,
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: false,
    },
    tools: {
      ownerOnlyAvailable: [],
      called: [],
      callCount: 0,
      lastStartedAt: null,
    },
    lifecycle: {
      queuedMs: 0,
      durationMs: null,
      timeoutMs: null,
      timedOut: false,
      deliveredMessageCount: 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
  };
}

describe('contextLensEventFromStewardRun', () => {
  it('makes partial Steward rows usable as native live events', () => {
    const event = contextLensEventFromStewardRun({
      botShip: 'bus',
      complete: false,
      receivedAt: 3,
      payload: { schemaVersion: 1, lens: lens() },
    });

    expect(event).toEqual(
      expect.objectContaining({
        at: 3,
        phase: 'steward',
        lens: expect.objectContaining({
          lensId: 'lens-1',
          botShip: '~bus',
          status: 'tool_running',
        }),
      })
    );
  });

  it('marks final rows and rejects invalid payloads', () => {
    expect(
      contextLensEventFromStewardRun({
        botShip: '~bus',
        complete: true,
        receivedAt: 4,
        payload: {
          schemaVersion: 1,
          lens: { ...lens(), status: 'completed' },
        },
      })?.phase
    ).toBe('steward-final');
    expect(
      contextLensEventFromStewardRun({
        botShip: '~bus',
        complete: false,
        receivedAt: 4,
        payload: { nope: true },
      })
    ).toBeNull();
  });

  it('does not leave expired partial runs looking live forever', () => {
    const event = contextLensEventFromStewardRun(
      {
        botShip: '~bus',
        complete: false,
        receivedAt: 4,
        payload: {
          schemaVersion: 1,
          lens: { ...lens(), expiresAt: 10 },
        },
      },
      11
    );

    expect(event?.phase).toBe('steward-stale');
    expect(event?.lens.status).toBe('aborted');
    expect(event?.lens.error).toBe('Run expired before a terminal update.');
  });

  it('expires idle gateway snapshots without changing terminal snapshots', () => {
    const live: ContextLensEvent = {
      seq: 1,
      at: 4,
      phase: 'tool_start',
      lens: { ...lens(), expiresAt: 10 },
    };
    expect(contextLensEventAtTime(live, 11)).toMatchObject({
      phase: 'stale',
      lens: { status: 'aborted' },
    });
    const completed = {
      ...live,
      lens: { ...live.lens, status: 'completed' as const },
    };
    expect(contextLensEventAtTime(completed, 11)).toBe(completed);
  });
});
