import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';

import { SizableText, XStack } from '../../core';
import { useReactionDetails } from '../../utils/postUtils';
import { SizableEmoji } from '../Emoji/SizableEmoji';

export function ReactionsDisplay({
  post,
  currentUserId,
}: {
  post: db.PostWithRelations | db.PostInsertWithAuthor;
  currentUserId: string;
}) {
  const reactionDetails = useReactionDetails(
    post.reactions ?? [],
    currentUserId
  );

  if (reactionDetails.list.length === 0) {
    return null;
  }

  return (
    <XStack padding="$m" paddingLeft="$4xl" borderRadius="$m">
      {reactionDetails.list.map((reaction) => (
        <XStack
          justifyContent="center"
          alignItems="center"
          backgroundColor={
            reaction.value === reactionDetails.self.value
              ? '$positiveBackground'
              : '$secondaryBackground'
          }
          padding="$xs"
          borderRadius="$m"
          disabled={
            reactionDetails.self.didReact &&
            reaction.value !== reactionDetails.self.value
          }
          onPress={() =>
            reactionDetails.self.didReact
              ? store.removePostReaction(post.channelId, post.id, currentUserId)
              : store.addPostReaction(
                  post.channelId,
                  post.id,
                  reaction.value,
                  currentUserId
                )
          }
        >
          <SizableEmoji
            key={reaction.value}
            shortCode={reaction.value}
            fontSize="$s"
          />
          {reaction.count > 0 && (
            <SizableText marginLeft="$s" size="$s" color="$secondaryText">
              {reaction.count}
            </SizableText>
          )}
        </XStack>
      ))}
    </XStack>
  );
}
