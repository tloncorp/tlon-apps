import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  getAgentOnboardingFirstEntryPendingAt,
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
  isAgentOnboardingFirstEntryNote,
  matchAgentOnboardingFirstEntryNote,
} from './agentOnboardingFirstEntry';

function markerPost(key: string, authorId = '~bot'): db.Post {
  return {
    id: key,
    authorId,
    receivedAt: 100,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-post-marker',
      version: 1,
      key,
    }),
  } as db.Post;
}

describe('hasAgentOnboardingFirstEntry', () => {
  it('recognizes the current channel-wide completion marker', () => {
    expect(
      hasAgentOnboardingFirstEntry([markerPost('first-entry-ping')], '~bot')
    ).toBe(true);
  });

  it('ignores unrelated markers', () => {
    expect(
      hasAgentOnboardingFirstEntry([markerPost('first-entry-pending')], '~bot')
    ).toBe(false);
  });

  it('recognizes a failed initial run as terminal for setup activity', () => {
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-failed')],
        '~bot'
      )
    ).toBe(true);
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-pending')],
        '~bot'
      )
    ).toBe(false);
  });

  it('ignores markers from anyone except the recorded agent', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [markerPost('first-entry-ping', '~other')],
        '~bot'
      )
    ).toBe(false);
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-failed', '~other')],
        '~bot'
      )
    ).toBe(false);
  });

  it('uses the bot pending marker as the start of the first-entry wait', () => {
    expect(
      getAgentOnboardingFirstEntryPendingAt(
        [
          markerPost('first-entry-pending', '~other'),
          {
            ...markerPost('first-entry-pending'),
            receivedAt: 200,
          },
        ],
        '~bot'
      )
    ).toBe(200);
    expect(
      getAgentOnboardingFirstEntryPendingAt(
        [markerPost('first-entry-ping')],
        '~bot'
      )
    ).toBeUndefined();
  });

  it('matches only the note cited by the first-entry reveal', () => {
    const reveal = {
      ...markerPost('first-entry-ping'),
      // This is the representation stored in the posts table. The renderer
      // deserializes it before displaying the reference card, and telemetry
      // must do the same before trying to match the opened note.
      content: JSON.stringify([
        {
          type: 'reference',
          referenceType: 'note',
          channelId: 'notes/~ten/updates',
          noteId: '7',
        },
      ]),
    } as db.Post;

    expect(
      isAgentOnboardingFirstEntryNote([reveal], '~bot', '~ten/updates', 7)
    ).toBe(true);
    expect(
      isAgentOnboardingFirstEntryNote([reveal], '~bot', '~ten/updates', 8)
    ).toBe(false);
    expect(
      matchAgentOnboardingFirstEntryNote([reveal], '~bot', '~ten/updates', 8)
    ).toBe('different');
    expect(
      matchAgentOnboardingFirstEntryNote([], '~bot', '~ten/updates', 8)
    ).toBe('absent');
  });

  it('continues past malformed reveal content', () => {
    const malformedReveal = {
      ...markerPost('first-entry-ping'),
      content: '{',
    } as db.Post;
    const validReveal = {
      ...markerPost('first-entry-ping'),
      id: 'valid-reveal',
      content: JSON.stringify([
        {
          type: 'reference',
          referenceType: 'note',
          channelId: 'notes/~ten/updates',
          noteId: '7',
        },
      ]),
    } as db.Post;

    expect(
      matchAgentOnboardingFirstEntryNote(
        [malformedReveal, validReveal],
        '~bot',
        '~ten/updates',
        7
      )
    ).toBe('match');
  });
});
