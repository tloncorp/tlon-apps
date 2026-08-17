import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import { hasAgentOnboardingFirstEntry } from './agentOnboardingFirstEntry';

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

  it('recognizes the legacy provision-scoped completion marker', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [markerPost('first-entry-ping:provision-1')],
        'provision-1'
      )
    ).toBe(true);
  });

  it('ignores unrelated and differently scoped markers', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [
          markerPost('first-entry-pending'),
          markerPost('first-entry-ping:provision-2'),
        ],
        'provision-1'
      )
    ).toBe(false);
  });
});
