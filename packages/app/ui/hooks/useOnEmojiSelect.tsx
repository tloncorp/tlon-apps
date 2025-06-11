import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useCurrentUserId } from '../contexts';
import { triggerHaptic } from '../utils';
import { useReactionDetails } from '../utils/postUtils';

export default function useOnEmojiSelect(
  post: db.Post | null,
  onDismiss: () => void
) {
  const currentUserId = useCurrentUserId();
  const details = useReactionDetails(post?.reactions ?? [], currentUserId);

  const onEmojiSelect = useCallback(
    async (value: string) => {
      if (!post) {
        return;
      }
      details.self.didReact && details.self.value.includes(value)
        ? store.removePostReaction(post, currentUserId)
        : store.addPostReaction(post, value, currentUserId);

      triggerHaptic('success');

      setTimeout(() => onDismiss(), 50);
    },
    [onDismiss, post, details.self.didReact, details.self.value, currentUserId]
  );

  return onEmojiSelect;
}
