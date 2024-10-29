import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';
import { XStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { triggerHaptic } from '../../utils';
import { useReactionDetails } from '../../utils/postUtils';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Text } from '../TextV2';

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
      paddingBottom="$l"
      paddingLeft="$4xl"
      borderRadius="$m"
      gap="$xs"
      flexWrap="wrap"
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
          {reaction.count > 0 && <Text size="$label/m">{reaction.count}</Text>}
        </XStack>
      ))}
    </XStack>
  );
}
