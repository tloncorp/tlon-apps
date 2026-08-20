import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { createDevLogger } from '@tloncorp/shared/debug';
import { A2UI, getRandomId } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useMemo, useState } from 'react';

const logger = createDevLogger('interactiveSurface', false);

/**
 * How long a tap may sit in optimistic state before the card falls back to
 * whatever the post says.
 *
 * This is a protocol requirement rather than a safety net. An action the agent
 * has already applied produces *no edit at all* — see
 * docs/tlon-apps/interactive-surfaces.md — so a client waiting on one receives
 * no event ever. Without this the card spins forever.
 */
export const INTERACTIVE_ACTION_TIMEOUT_MS = 15_000;

type SurfaceActionContext = A2UI.SurfaceActionEvent['context'];

type PendingTap = {
  surfaceId: string;
  /** Which control was pressed, so only that one shows as pending. */
  controlKey: string;
  actionId: string;
  /**
   * The revision the tap was made against, or undefined when the card carried
   * no surface entry and the tap opted into last-write-wins.
   */
  revisionAtTap: number | undefined;
};

export type A2UIActionState = 'idle' | 'pending';

/**
 * A stable identity for one control on one surface.
 *
 * Includes `params` because two buttons can share a `name` and differ only in
 * what they carry — "set portions to 2" and "set portions to 4" are the same
 * action name and different controls.
 */
function controlKeyFor(context: SurfaceActionContext): string {
  return JSON.stringify([
    context.surfaceId,
    context.name,
    context.params ?? null,
  ]);
}

/**
 * The client half of the interactive surface protocol for one post.
 *
 * The card itself always renders from the post — this hook adds nothing to
 * that, deliberately. All it holds is the single tap currently in flight, so
 * that the button can show feedback, and it drops that the moment the post can
 * answer for itself.
 *
 * See docs/tlon-apps/interactive-surfaces.md.
 */
export function useInteractiveSurface(post: db.Post) {
  const [pending, setPending] = useState<PendingTap | null>(null);

  const surfaceFor = useCallback(
    (surfaceId: string) => api.findInteractiveSurface(post.blob, surfaceId),
    [post.blob]
  );

  // Reconcile against the post. Two independent signals, and both are needed:
  // the revision advancing past the tap, or the action id appearing in
  // processedActionIds. An applied action that resolved to unchanged state does
  // not bump the revision, so watching the revision alone would wait forever on
  // a legitimate no-change.
  useEffect(() => {
    if (!pending) {
      return;
    }
    const surface = api.findInteractiveSurface(post.blob, pending.surfaceId);
    if (!surface) {
      return;
    }
    const advanced =
      pending.revisionAtTap !== undefined &&
      surface.revision > pending.revisionAtTap;
    const applied = api.hasAppliedInteractiveAction(surface, pending.actionId);
    if (advanced || applied) {
      setPending(null);
    }
  }, [post.blob, pending]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = setTimeout(() => {
      logger.log('interactive action timed out; reverting to post state', {
        postId: post.id,
        surfaceId: pending.surfaceId,
        actionId: pending.actionId,
      });
      setPending(null);
    }, INTERACTIVE_ACTION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, post.id]);

  const emitSurfaceAction = useCallback(
    async (context: SurfaceActionContext) => {
      // One tap in flight per post. A second would carry the same revision the
      // first did and be rejected as a conflict, so suppressing it is both the
      // idempotency guarantee and the honest thing to show.
      if (pending) {
        return;
      }

      const surface = api.findInteractiveSurface(post.blob, context.surfaceId);
      const actionId = getRandomId();
      const pendingTap: PendingTap = {
        surfaceId: context.surfaceId,
        controlKey: controlKeyFor(context),
        actionId,
        revisionAtTap: surface?.revision,
      };
      setPending(pendingTap);

      try {
        await api.sendReply({
          authorId: api.getCurrentUserId(),
          channelId: post.channelId,
          parentId: post.id,
          parentAuthor: post.authorId,
          // No visible content: this reply is a record of a tap, and clients
          // hide a reply whose blob is exactly one interactive-action.
          content: [],
          blob: api.appendInteractiveActionToPostBlob(undefined, {
            targetPostId: post.id,
            targetChannelId: post.channelId,
            surfaceId: context.surfaceId,
            actionId,
            // Omitted when the card carries no surface entry yet: there is no
            // revision to reference, and the protocol treats an absent
            // expectedRevision as an explicit opt-in to last-write-wins.
            expectedRevision: surface?.revision,
            name: context.name,
            params: context.params,
          }),
          sentAt: Date.now(),
        });
      } catch (e) {
        // Nothing to roll back — the card renders from the post, which never
        // changed. Dropping the pending record puts the button back.
        logger.trackError('Failed to send interactive action', {
          postId: post.id,
          surfaceId: context.surfaceId,
          error: e,
        });
        setPending(null);
      }
    },
    [pending, post.blob, post.channelId, post.id, post.authorId]
  );

  const getA2UIActionState = useCallback(
    (action: A2UI.Button['action']): A2UIActionState => {
      if (action.event.name !== A2UI.action.surfaceAction) {
        return 'idle';
      }
      return pending?.controlKey === controlKeyFor(action.event.context)
        ? 'pending'
        : 'idle';
    },
    [pending]
  );

  const isSurfaceActionAvailable = useCallback(
    (context: SurfaceActionContext) => {
      // Every control on a surface with a tap in flight is unavailable, not
      // just the one that was pressed: any other tap would carry the same
      // revision and lose the conflict check.
      return pending?.surfaceId !== context.surfaceId;
    },
    [pending]
  );

  return useMemo(
    () => ({
      surfaceFor,
      emitSurfaceAction,
      getA2UIActionState,
      isSurfaceActionAvailable,
    }),
    [
      surfaceFor,
      emitSurfaceAction,
      getA2UIActionState,
      isSurfaceActionAvailable,
    ]
  );
}
