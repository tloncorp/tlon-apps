import { describe, expect, it } from 'vitest';

import { canRetryLens, formatWallDateTime } from './format';
import type { ContextLens, ContextLensStatus } from './types';

function makeLens(overrides: Partial<ContextLens> = {}): ContextLens {
  return {
    lensId: 'lens-1',
    messageId: 'message-1',
    chatType: 'dm',
    trigger: 'dm',
    model: null,
    provider: null,
    status: 'completed',
    error: null,
    createdAt: 0,
    updatedAt: 0,
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
    ...overrides,
  };
}

describe('canRetryLens', () => {
  it('allows failed terminal statuses', () => {
    const statuses: ContextLensStatus[] = [
      'no_reply',
      'timed_out',
      'aborted',
      'error',
    ];
    for (const status of statuses) {
      expect(canRetryLens(makeLens({ status }))).toBe(true);
    }
  });

  it('refuses completed and in-flight runs', () => {
    const statuses: ContextLensStatus[] = [
      'completed',
      'assembling',
      'queued',
      'dispatching',
      'tool_running',
      'delivering',
    ];
    for (const status of statuses) {
      expect(canRetryLens(makeLens({ status }))).toBe(false);
    }
  });

  it('refuses internal runs even when failed', () => {
    expect(
      canRetryLens(makeLens({ status: 'error', chatType: 'internal' }))
    ).toBe(false);
    expect(
      canRetryLens(makeLens({ status: 'error', runKind: 'internal' }))
    ).toBe(false);
  });
});

describe('formatWallDateTime', () => {
  it('includes the run date and time', () => {
    const timestamp = new Date(2026, 6, 15, 13, 32, 27).getTime();

    expect(formatWallDateTime(timestamp)).toBe(
      new Date(timestamp).toLocaleString([], {
        year: '2-digit',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  });

  it('handles missing timestamps', () => {
    expect(formatWallDateTime()).toBe('unknown');
  });
});
