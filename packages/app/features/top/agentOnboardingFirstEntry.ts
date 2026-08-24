import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

const FIRST_ENTRY_MARKER = 'first-entry-ping';
const FIRST_ENTRY_FAILED_MARKER = 'first-entry-failed';

/**
 * Provision acknowledgement belongs to the channel transcript, not to any
 * particular mounted message row. Detect it from the loaded post set so the
 * navigation lock can advance even when the acknowledgement row is virtualized.
 */
export function hasAgentOnboardingProvisionAcknowledgement(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined,
  provisionId: string | null | undefined
): boolean {
  if (!agentShipId || !provisionId) return false;
  return Boolean(
    posts?.some(
      (post) =>
        post.authorId === agentShipId &&
        post.blob &&
        parsePostBlob(post.blob).some(
          (entry) =>
            entry.type === 'tlon-agent-provision-ack' &&
            entry.provisionId === provisionId
        )
    )
  );
}

/**
 * The current coordinator marks completion once per channel. Older hosted
 * plugins scoped the same marker to the provision id, so accept both while
 * test ships and durable transcripts migrate.
 */
export function hasAgentOnboardingFirstEntry(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined,
  provisionId?: string
): boolean {
  if (!agentShipId) return false;
  const legacyMarker = provisionId
    ? `${FIRST_ENTRY_MARKER}:${provisionId}`
    : null;
  return Boolean(
    posts?.some(
      (post) =>
        post.authorId === agentShipId &&
        post.blob &&
        parsePostBlob(post.blob).some(
          (entry) =>
            entry.type === 'tlon-agent-post-marker' &&
            (entry.key === FIRST_ENTRY_MARKER || entry.key === legacyMarker)
        )
    )
  );
}

/** A failed initial cron run is terminal for the setup activity indicator. */
export function hasAgentOnboardingFirstEntryFailed(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined
): boolean {
  if (!agentShipId) return false;
  return Boolean(
    posts?.some(
      (post) =>
        post.authorId === agentShipId &&
        post.blob &&
        parsePostBlob(post.blob).some(
          (entry) =>
            entry.type === 'tlon-agent-post-marker' &&
            entry.key === FIRST_ENTRY_FAILED_MARKER
        )
    )
  );
}
