import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { SizableEmoji } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Tooltip, XStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { triggerHaptic } from '../../utils';
import { ReactionListItem, useReactionDetails } from '../../utils/postUtils';

export function ReactionsDisplay({
  post,
  onViewPostReactions,
  minimal = false,
}: {
  post: db.Post;
  onViewPostReactions?: (post: db.Post) => void;
  minimal?: boolean;
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

  const firstThreeReactionUsers = useCallback(
    (reaction: ReactionListItem) =>
      reaction.users
        ? reaction.users
            .slice(0, 3)
            .map((user) => user.name)
            .join(', ') +
          (reaction.users.length > 3
            ? ` +${reaction.users.length - 3} more`
            : '')
        : '',
    []
  );

  if (reactionDetails.list.length === 0) {
    return null;
  }

  if (minimal) {
    const displayedReactions = reactionDetails.list.slice(0, 2);
    const remainingCount = reactionDetails.list.length - 2;

    return (
      <Pressable onPress={() => handleOpenReactions(post)}>
        <XStack gap="$2xs" alignItems="center">
          {displayedReactions.map((reaction) => (
            <Pressable
              key={reaction.value}
              onPress={() => handleModifyYourReaction(reaction.value)}
              testID={`ReactionDisplay-minimal`}
            >
              <Tooltip placement="top" delay={0} restMs={25}>
                <Tooltip.Trigger>
                  <XStack
                    key={reaction.value}
                    justifyContent="center"
                    alignItems="center"
                  >
                    <SizableEmoji
                      key={reaction.value}
                      shortCode={reaction.value}
                      fontSize="$s"
                    />
                  </XStack>
                </Tooltip.Trigger>
                <Tooltip.Content
                  padding="$s"
                  backgroundColor="$secondaryBackground"
                  borderRadius="$s"
                >
                  <Text size="$label/m">
                    {firstThreeReactionUsers(reaction)}
                  </Text>
                </Tooltip.Content>
              </Tooltip>
            </Pressable>
          ))}
          {remainingCount > 0 && (
            <Text size="$label/s" color="$primaryText">
              +{remainingCount}
            </Text>
          )}
        </XStack>
      </Pressable>
    );
  }

  return (
    <Pressable borderRadius="$m" onLongPress={() => handleOpenReactions(post)}>
      <XStack borderRadius="$m" gap="$xs" flexWrap="wrap">
        {reactionDetails.list.map((reaction) => (
          <Pressable
            key={reaction.value}
            borderRadius="$s"
            onPress={() => handleModifyYourReaction(reaction.value)}
            onLongPress={() => handleOpenReactions(post)}
            testID={`ReactionDisplay`}
          >
            <Tooltip placement="top" delay={0} restMs={25}>
              <Tooltip.Trigger>
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
                >
                  <SizableEmoji
                    key={reaction.value}
                    shortCode={reaction.value}
                    fontSize="$s"
                  />
                  {reaction.count > 0 && (
                    <Text size="$label/m">{reaction.count}</Text>
                  )}
                </XStack>
              </Tooltip.Trigger>
              <Tooltip.Content
                padding="$s"
                backgroundColor="$secondaryBackground"
                borderRadius="$s"
              >
                <Text size="$label/m">{firstThreeReactionUsers(reaction)}</Text>
              </Tooltip.Content>
            </Tooltip>
          </Pressable>
        ))}
      </XStack>
    </Pressable>
  );
}
