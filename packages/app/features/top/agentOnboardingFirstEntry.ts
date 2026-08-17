import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

const FIRST_ENTRY_MARKER = 'first-entry-ping';

/**
 * The current coordinator marks completion once per channel. Older hosted
 * plugins scoped the same marker to the provision id, so accept both while
 * test ships and durable transcripts migrate.
 */
export function hasAgentOnboardingFirstEntry(
  posts: db.Post[] | null | undefined,
  provisionId?: string
): boolean {
  const legacyMarker = provisionId
    ? `${FIRST_ENTRY_MARKER}:${provisionId}`
    : null;
  return Boolean(
    posts?.some(
      (post) =>
        post.blob &&
        parsePostBlob(post.blob).some(
          (entry) =>
            entry.type === 'tlon-agent-post-marker' &&
            (entry.key === FIRST_ENTRY_MARKER || entry.key === legacyMarker)
        )
    )
  );
}
