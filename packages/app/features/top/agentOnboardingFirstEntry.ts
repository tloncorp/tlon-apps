import {
  AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER,
  AGENT_ONBOARDING_FIRST_ENTRY_MARKER,
  findPostBlobEntry,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

function hasMarker(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined,
  key: string
) {
  if (!agentShipId) return false;
  return Boolean(
    posts?.some(
      (post) =>
        post.authorId === agentShipId &&
        findPostBlobEntry(post.blob, 'tlon-agent-post-marker')?.key === key
    )
  );
}

/** The coordinator marks completion once per channel. */
export function hasAgentOnboardingFirstEntry(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined
): boolean {
  return hasMarker(posts, agentShipId, AGENT_ONBOARDING_FIRST_ENTRY_MARKER);
}

/** A failed initial cron run is terminal for the setup activity indicator. */
export function hasAgentOnboardingFirstEntryFailed(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined
): boolean {
  return hasMarker(
    posts,
    agentShipId,
    AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER
  );
}
