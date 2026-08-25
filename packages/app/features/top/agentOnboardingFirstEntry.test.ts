import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
} from './agentOnboardingFirstEntry';

function markerPost(key: string): db.Post {
  return {
    id: key,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-post-marker',
      version: 1,
      key,
    }),
  } as db.Post;
}

describe('hasAgentOnboardingFirstEntry', () => {
  it('recognizes the current channel-wide completion marker', () => {
    expect(hasAgentOnboardingFirstEntry([markerPost('first-entry-ping')])).toBe(
      true
    );
  });

  it('ignores unrelated markers', () => {
    expect(
      hasAgentOnboardingFirstEntry([markerPost('first-entry-pending')])
    ).toBe(false);
  });

  it('recognizes a failed initial run as terminal for setup activity', () => {
    expect(
      hasAgentOnboardingFirstEntryFailed([markerPost('first-entry-failed')])
    ).toBe(true);
    expect(
      hasAgentOnboardingFirstEntryFailed([markerPost('first-entry-pending')])
    ).toBe(false);
  });
});
