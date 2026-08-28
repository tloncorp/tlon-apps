import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
  isAgentOnboardingFirstEntryNote,
  matchAgentOnboardingFirstEntryNote,
} from './agentOnboardingFirstEntry';

function markerPost(key: string, authorId = '~bot'): db.Post {
  return {
    id: key,
    authorId,
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

  it('matches only the note cited by the first-entry reveal', () => {
    const reveal = {
      ...markerPost('first-entry-ping'),
      content: [
        {
          type: 'reference',
          referenceType: 'note',
          channelId: 'notes/~ten/updates',
          noteId: '7',
        },
      ],
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
});
