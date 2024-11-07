import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { isWeb } from 'tamagui';

import { useCurrentUserId } from '../contexts';
import { useReactionDetails } from '../utils/postUtils';

export default function useOnEmojiSelect(
  post: db.Post | null,
  onDismiss: () => void
) {
  const currentUserId = useCurrentUserId();
  const details = useReactionDetails(post?.reactions ?? [], currentUserId);

  const onEmojiSelect = useCallback(
    async (shortCode: string) => {
      if (!post) {
        return;
      }
      details.self.didReact && details.self.value.includes(shortCode)
        ? store.removePostReaction(post, currentUserId)
        : store.addPostReaction(post, shortCode, currentUserId);
      if (!isWeb) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
      setTimeout(() => onDismiss(), 50);
    },
    [onDismiss, post, details.self.didReact, details.self.value, currentUserId]
  );

  return onEmojiSelect;
}
