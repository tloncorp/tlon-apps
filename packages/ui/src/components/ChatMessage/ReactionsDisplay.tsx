import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { SizableText, XStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { triggerHaptic } from '../../utils';
import { useReactionDetails } from '../../utils/postUtils';
import { SizableEmoji } from '../Emoji/SizableEmoji';

export function ReactionsDisplay({
  post,
  onViewPostReactions,
}: {
  post: db.Post;
  onViewPostReactions?: (post: db.Post) => void;
}) {
  const currentUserId = useCurrentUserId();
  const reactionDetails = useReactionDetails(
    post.reactions ?? [],
    currentUserId
  );

  const handleOpenReactions = useCallback(
    (post: db.Post) => {
      triggerHaptic('sheetOpen');
      onViewPostReactions?.(post);
    },
    [onViewPostReactions]
  );

  const handleModifyYourReaction = useCallback(
    (value: string) => {
      triggerHaptic('baseButtonClick');
      reactionDetails.self.didReact
        ? store.removePostReaction(post, currentUserId)
        : store.addPostReaction(post, value, currentUserId);
    },
    [currentUserId, post, reactionDetails.self.didReact]
  );

  if (reactionDetails.list.length === 0) {
    return null;
  }

  return (
    <XStack
      paddingBottom="$m"
      paddingLeft="$4xl"
      borderRadius="$m"
      gap="$xs"
      onLongPress={() => handleOpenReactions(post)}
    >
      {reactionDetails.list.map((reaction) => (
        <XStack
          key={reaction.value}
          justifyContent="center"
          alignItems="center"
          backgroundColor={
            reaction.value === reactionDetails.self.value
              ? '$positiveBackground'
              : '$secondaryBackground'
          }
          padding="$xs"
          paddingHorizontal="$s"
          height="$3xl"
          borderRadius="$s"
          borderColor={
            reaction.value === reactionDetails.self.value
              ? '$positiveBorder'
              : '$border'
          }
          borderWidth={1}
          gap={'$s'}
          disabled={
            reactionDetails.self.didReact &&
            reaction.value !== reactionDetails.self.value
          }
          onPress={() => handleModifyYourReaction(reaction.value)}
          onLongPress={() => handleOpenReactions(post)}
        >
          <SizableEmoji
            key={reaction.value}
            shortCode={reaction.value}
            fontSize="$s"
          />
          {reaction.count > 0 && (
            <SizableText color="$secondaryText" lineHeight="$m" height="$2xl">
              {reaction.count}
            </SizableText>
          )}
        </XStack>
      ))}
    </XStack>
  );
}
