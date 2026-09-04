import * as api from '@tloncorp/api';
import {
  SurfaceEventEntrySchema,
  SurfaceSpec,
  getDeclaredAction,
} from '@tloncorp/api';
import { constructStory } from '@tloncorp/api/urbit';

import { createDevLogger } from '../../debug';

const logger = createDevLogger('surfaceInvoke', false);

/**
 * Build the one-entry blob for a `mode: 'invoke'` surface event, validated
 * against the ratified schema. The host stamps `specRevision` from its own
 * spec (never the sandbox message); the entry carries no ops — the reducer
 * resolves them from the governing spec. Returns null when the shape
 * doesn't validate (e.g. a malformed actionId), so no invalid blob posts.
 */
export function buildSurfaceInvokeBlob(params: {
  surfaceId: string;
  specRevision: number;
  actionId: string;
}): string | null {
  const entry = {
    type: 'surface-event' as const,
    version: 1 as const,
    surfaceId: params.surfaceId,
    specRevision: params.specRevision,
    mode: 'invoke' as const,
    actionId: params.actionId,
  };
  if (!SurfaceEventEntrySchema.safeParse(entry).success) {
    return null;
  }
  return JSON.stringify([entry]);
}

/**
 * Post a member invoke to a surface channel (plan §5, §9 writer
 * disciplines):
 *
 * - exactly one surface entry per post, under kind tail `surface/event`;
 * - fallback Story text so pre-surface clients degrade to an inert chat
 *   message;
 * - `specRevision` stamped from the host's own spec, never a message;
 * - the action must be declared by that same spec, and the blob must
 *   validate — the writer re-checks both rather than trusting whichever
 *   caller reached it, so an undeclared action never becomes a signed
 *   post no matter how it got here;
 * - success is judged by the post being observed back through the
 *   channel subscription and refolded — NOT by the poke ack. This action
 *   only fires the post; the hydration layer converges on the result.
 */
export async function sendSurfaceInvoke({
  channelId,
  spec,
  actionId,
}: {
  channelId: string;
  spec: SurfaceSpec;
  actionId: string;
}): Promise<void> {
  // own-property lookup, so an inherited name can never resolve
  if (getDeclaredAction(spec, actionId) === undefined) {
    logger.trackError('refusing to post an undeclared surface action', {
      channelId,
      actionId,
    });
    return;
  }

  const blob = buildSurfaceInvokeBlob({
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    actionId,
  });
  if (blob === null) {
    logger.trackError('refusing to post malformed surface invoke', {
      channelId,
      actionId,
    });
    return;
  }

  const authorId = api.getCurrentUserId();
  const fallback = constructStory([
    `Used “${actionId}”. Update Tlon to view this dashboard.`,
  ]);

  await api.sendPost({
    channelId,
    authorId,
    content: fallback,
    blob,
    sentAt: Date.now(),
    kindTail: 'surface/event',
  });
}
