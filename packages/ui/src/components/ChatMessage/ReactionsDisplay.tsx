import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';

import { SizableText, XStack } from '../../core';
import { useReactionDetails } from '../../utils/postUtils';
import { SizableEmoji } from '../Emoji/SizableEmoji';

export function ReactionsDisplay({
  post,
  currentUserId,
}: {
  post: db.Post;
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
    <XStack paddingLeft="$4xl" borderRadius="$m" gap="$xs">
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
          onPress={() =>
            reactionDetails.self.didReact
              ? store.removePostReaction(post, currentUserId)
              : store.addPostReaction(post, reaction.value, currentUserId)
          }
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
