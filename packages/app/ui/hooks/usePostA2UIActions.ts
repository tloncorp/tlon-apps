import * as db from '@tloncorp/shared/db';
import { A2UI } from '@tloncorp/shared/logic';
import { useCallback } from 'react';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import { useDraftInputContext } from '../components/draftInputs/shared';
import { useInteractiveSurface } from './useInteractiveSurface';

/**
 * The handlers behind a post's A2UI buttons, independent of where the post is
 * drawn: `tlon.navigate` routes, `tlon.surfaceAction` emits an action reply
 * through the interactive-surface machinery, and `tlon.sendMessage` posts the
 * button's text into the current conversation as the tapping user. Extracted
 * from StaticChatMessage so the pinned surface canvas can render a card
 * chromelessly with identical button behavior.
 */
export function usePostA2UIActions(post: db.Post) {
  const draftInputContext = useDraftInputContext();
  const navigateToA2UITarget = useA2UINavigation();
  const interactiveSurface = useInteractiveSurface(post);

  const onA2UIAction = useCallback(
    async (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.navigate) {
        await navigateToA2UITarget(action.event.context.target);
        return;
      }

      if (action.event.name === A2UI.action.surfaceAction) {
        await interactiveSurface.emitSurfaceAction(action.event.context);
        return;
      }

      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        return;
      }

      const text = action.event.context.text.trim();
      if (!text) {
        return;
      }

      await draftInputContext.sendPostFromDraft({
        channelId: draftInputContext.channel.id,
        content: [text],
        attachments: [],
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
    },
    [draftInputContext, navigateToA2UITarget, interactiveSurface]
  );

  const isA2UIActionAvailable = useCallback(
    (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.navigate) {
        return true;
      }

      if (action.event.name === A2UI.action.sendMessage) {
        return Boolean(
          draftInputContext &&
            draftInputContext.canStartDraft !== false &&
            action.event.context.text.trim()
        );
      }

      if (action.event.name === A2UI.action.surfaceAction) {
        // Tapping a card is posting a reply, so it needs the same permission
        // typing does. Beyond that, every control on a surface goes unavailable
        // while one of its taps is in flight.
        return Boolean(
          draftInputContext &&
            draftInputContext.canStartDraft !== false &&
            interactiveSurface.isSurfaceActionAvailable(action.event.context)
        );
      }

      return false;
    },
    [draftInputContext, interactiveSurface]
  );

  return {
    onA2UIAction,
    isA2UIActionAvailable,
    getA2UIActionState: interactiveSurface.getA2UIActionState,
  };
}
