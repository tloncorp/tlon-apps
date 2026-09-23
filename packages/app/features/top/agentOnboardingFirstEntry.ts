import {
  AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER,
  AGENT_ONBOARDING_FIRST_ENTRY_MARKER,
  findPostBlobEntry,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { convertContent } from '@tloncorp/shared/logic';

const AGENT_ONBOARDING_FIRST_ENTRY_PENDING_MARKER = 'first-entry-pending';

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

/** The pending post is transcript proof that the bot started the first run. */
export function getAgentOnboardingFirstEntryPendingAt(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined
): number | undefined {
  if (!agentShipId) return undefined;

  let latest: number | undefined;
  for (const post of posts ?? []) {
    if (
      post.authorId !== agentShipId ||
      findPostBlobEntry(post.blob, 'tlon-agent-post-marker')?.key !==
        AGENT_ONBOARDING_FIRST_ENTRY_PENDING_MARKER
    ) {
      continue;
    }
    latest =
      latest == null ? post.receivedAt : Math.max(latest, post.receivedAt);
  }
  return latest;
}

/** Match the opened note to the cite carried by the authenticated reveal. */
export function matchAgentOnboardingFirstEntryNote(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined,
  notebookFlag: string,
  noteId: number
): 'absent' | 'different' | 'match' {
  if (!agentShipId) return 'absent';
  let foundReference = false;
  for (const post of posts ?? []) {
    if (
      post.authorId !== agentShipId ||
      findPostBlobEntry(post.blob, 'tlon-agent-post-marker')?.key !==
        AGENT_ONBOARDING_FIRST_ENTRY_MARKER
    ) {
      continue;
    }
    // Posts persist their normalized story as JSON text. Renderers deserialize
    // it through convertContent, but this telemetry path used to inspect only
    // an already-decoded array. Consequently every real reveal looked like it
    // had no note reference and Agent Entry First Opened never fired.
    let content;
    try {
      content = convertContent(post.content, post.blob);
    } catch {
      // A malformed post must not prevent a later valid reveal from matching.
      continue;
    }
    for (const entry of content) {
      const isNoteReference =
        entry &&
        typeof entry === 'object' &&
        'type' in entry &&
        entry.type === 'reference' &&
        'referenceType' in entry &&
        entry.referenceType === 'note' &&
        'channelId' in entry &&
        'noteId' in entry;
      if (!isNoteReference) continue;
      foundReference = true;
      if (
        entry.channelId === `notes/${notebookFlag}` &&
        String(entry.noteId) === String(noteId)
      ) {
        return 'match';
      }
    }
  }
  return foundReference ? 'different' : 'absent';
}

export function isAgentOnboardingFirstEntryNote(
  posts: db.Post[] | null | undefined,
  agentShipId: string | null | undefined,
  notebookFlag: string,
  noteId: number
): boolean {
  return (
    matchAgentOnboardingFirstEntryNote(
      posts,
      agentShipId,
      notebookFlag,
      noteId
    ) === 'match'
  );
}
