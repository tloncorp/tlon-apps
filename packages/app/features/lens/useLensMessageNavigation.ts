import { getCanonicalPostId } from '@tloncorp/api/client';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import type { LensMessageTarget } from '../../ui/components/Channel/ContextLens/runFacts';

/** Opens a message a lens run names, as a trigger or as something it posted. */
export function useLensMessageNavigation(botShip: string) {
  const navigateFromA2UI = useA2UINavigation();
  return useCallback(
    async (target: LensMessageTarget) => {
      // Lens conversation ids are recorded from the bot's perspective: group
      // channels are nests (contain '/'), but DMs name the counterparty ship
      // — which on the owner's client is themselves. DM messages live in the
      // client's DM channel with the bot, whose id is the bot ship.
      const channelId = target.channelId?.includes('/')
        ? target.channelId
        : botShip;
      if (!channelId) {
        return;
      }
      // Lens payloads don't record thread parents. Output-row clicks supply
      // parentId from the resolved local post; trigger-row clicks (which
      // don't pre-resolve) fall back to a db lookup. Without parentId,
      // threaded replies dead-end in the channel scroller where they aren't
      // visible.
      let parentId: string | undefined = target.parentId;
      if (!parentId) {
        try {
          const post = await db.getPost({
            postId: getCanonicalPostId(target.postId),
          });
          parentId = post?.parentId ?? undefined;
        } catch {
          // post not cached locally — fall back to channel navigation
        }
      }
      navigateFromA2UI({
        type: 'message',
        channelId,
        postId: target.postId,
        parentId,
        authorId: target.authorId,
      });
    },
    [navigateFromA2UI, botShip]
  );
}
