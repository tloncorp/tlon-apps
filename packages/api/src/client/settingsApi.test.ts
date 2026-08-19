import { describe, expect, it } from 'vitest';

import type { GroupsDeskSettings } from '../urbit';
import { parseBotReplyFeedback } from './settingsApi';

describe('parseBotReplyFeedback', () => {
  it('hydrates valid JSON-encoded feedback entries and ignores malformed ones', () => {
    const settings: GroupsDeskSettings = {
      desk: {
        botReplyFeedback: {
          '~bot/valid': JSON.stringify({
            feedbackId: 'feedback-id',
            revision: 3,
            rating: 'down',
            categories: ['Missing context it should have'],
            submittedAt: 1_700_000_000_000,
          }),
          '~bot/invalid': '{not-json',
        },
      },
    };

    expect(parseBotReplyFeedback(settings)).toEqual([
      {
        messageId: '~bot/valid',
        feedbackId: 'feedback-id',
        revision: 3,
        rating: 'down',
        categories: ['Missing context it should have'],
        submittedAt: 1_700_000_000_000,
      },
    ]);
  });

  it('preserves cleared entries so their revision and stable id can advance', () => {
    const settings: GroupsDeskSettings = {
      desk: {
        botReplyFeedback: {
          '~bot/cleared': JSON.stringify({
            feedbackId: 'feedback-id',
            revision: 4,
            rating: null,
            categories: [],
            submittedAt: 1_700_000_000_001,
          }),
        },
      },
    };

    expect(parseBotReplyFeedback(settings)[0]?.rating).toBeNull();
    expect(parseBotReplyFeedback(settings)[0]?.revision).toBe(4);
  });
});
