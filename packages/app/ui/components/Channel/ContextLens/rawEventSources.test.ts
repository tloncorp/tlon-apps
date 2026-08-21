import { describe, expect, it } from 'vitest';

import {
  contextLensSourceFromStewardRun,
  contextLensSourcesFromLiveEvents,
  mergeContextLensRunSources,
} from './rawEventSources';
import type { ContextLens, ContextLensEvent } from './types';

function lens(status: ContextLens['status'] = 'tool_running'): ContextLens {
  return {
    lensId: 'lens-1',
    messageId: 'message-1',
    chatType: 'channel',
    trigger: 'mention',
    model: null,
    provider: null,
    status,
    error: null,
    createdAt: 1,
    updatedAt: 2,
    expiresAt: 10,
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

function liveEvent(): ContextLensEvent {
  return {
    seq: 7,
    at: 5,
    phase: 'tool_start',
    lens: lens(),
  };
}

describe('Context Lens raw event sources', () => {
  it('keeps a synced payload exact while rendering a stale projection', () => {
    const payload = {
      schemaVersion: 1,
      lens: lens(),
      futureGatewayField: { nested: true },
    };

    const source = contextLensSourceFromStewardRun(
      {
        botShip: '~bus',
        complete: false,
        receivedAt: 5,
        payload,
      },
      11
    );

    expect(source?.event).toMatchObject({
      seq: 0,
      phase: 'steward-stale',
      lens: { status: 'aborted' },
    });
    expect(source?.rawEnvelope).toBe(payload);
    expect(source?.rawEnvelope).toEqual({
      schemaVersion: 1,
      lens: expect.objectContaining({ status: 'tool_running' }),
      futureGatewayField: { nested: true },
    });
    expect(source?.rawEnvelope).not.toHaveProperty('seq');
    expect(source?.rawEnvelope).not.toHaveProperty('phase');
    expect(source?.rawEnvelope).toHaveProperty('lens.error', null);
    expect(source?.rawEnvelope).not.toHaveProperty(
      'lens.error',
      'Run expired before a terminal update.'
    );
  });

  it('pairs a local live projection with the exact SSE event', () => {
    const raw = liveEvent();
    const rendered: ContextLensEvent = {
      ...raw,
      phase: 'stale',
      lens: { ...raw.lens, status: 'aborted' },
    };

    const [source] = contextLensSourcesFromLiveEvents([rendered], [raw]);

    expect(source.event).toBe(rendered);
    expect(source.rawEnvelope).toBe(raw);
    expect(source.rawEnvelope).toMatchObject({
      seq: 7,
      phase: 'tool_start',
      lens: { status: 'tool_running' },
    });
  });

  it('carries the exact envelope belonging to the winning source', () => {
    const live = liveEvent();
    const [liveSource] = contextLensSourcesFromLiveEvents([live], [live]);
    const payload = {
      schemaVersion: 1,
      lens: { ...lens('completed'), updatedAt: 20 },
      retainedUnknownField: 'from-steward',
    };
    const stewardSource = contextLensSourceFromStewardRun({
      botShip: '~bus',
      complete: true,
      receivedAt: 20,
      payload,
    });

    const [selected] = mergeContextLensRunSources(
      [liveSource],
      stewardSource ? [stewardSource] : []
    );

    expect(selected.event.lens.status).toBe('completed');
    expect(selected.rawEnvelope).toBe(payload);
    expect(selected.rawEnvelope).toHaveProperty(
      'retainedUnknownField',
      'from-steward'
    );
  });
});
