import {
  AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER,
  AGENT_ONBOARDING_FIRST_ENTRY_MARKER,
  findPostBlobEntry,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

/**
 * The coordinator marks completion once per channel.
 */
export function hasAgentOnboardingFirstEntry(
  posts: db.Post[] | null | undefined
): boolean {
  return Boolean(
    posts?.some(
      (post) =>
        findPostBlobEntry(post.blob, 'tlon-agent-post-marker')?.key ===
        AGENT_ONBOARDING_FIRST_ENTRY_MARKER
    )
  );
}

/** A failed initial cron run is terminal for the setup activity indicator. */
export function hasAgentOnboardingFirstEntryFailed(
  posts: db.Post[] | null | undefined
): boolean {
  return Boolean(
    posts?.some(
      (post) =>
        findPostBlobEntry(post.blob, 'tlon-agent-post-marker')?.key ===
        AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER
    )
  );
}
