import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon, SizableEmoji, getNativeEmoji } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Tooltip, View, XStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { triggerHaptic } from '../../utils';
import { ReactionListItem, useReactionDetails } from '../../utils/postUtils';
import { EmojiPickerSheet } from '../Emoji';

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
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectEmoji = useOnEmojiSelect(post, () => setSheetOpen(false));

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
      if (
        reactionDetails.self.didReact &&
        reactionDetails.self.value === value
      ) {
        store.removePostReaction(post, currentUserId);
      } else {
        // Convert legacy shortcodes to native emojis before adding reaction
        const nativeEmoji = getNativeEmoji(value);
        if (nativeEmoji) {
          store.addPostReaction(post, nativeEmoji, currentUserId);
        }
        // If nativeEmoji is undefined, it means the input was an invalid shortcode
        // and we should not add the reaction
      }
    },
    [
      currentUserId,
      post,
      reactionDetails.self.didReact,
      reactionDetails.self.value,
    ]
  );

  const firstThreeReactionUsers = useCallback((reaction: ReactionListItem) => {
    if (!reaction.users || reaction.users.length === 0) {
      return '';
    }

    const userNames = reaction.users
      .slice(0, 3)
      .map((user) => {
        // Defensive logic: ensure we have a valid name or fall back to id
        const name = user.name && user.name.trim() !== '' ? user.name : user.id;
        return name || 'Unknown'; // Final fallback if both are somehow empty
      })
      .join(', ');

    const moreCount = reaction.users.length - 3;
    return userNames + (moreCount > 0 ? ` +${moreCount} more` : '');
  }, []);

  if (minimal) {
    if (reactionDetails.list.length === 0) {
      return null;
    }
    const displayedReactions = reactionDetails.list.slice(0, 2);
    const remainingCount = reactionDetails.list.length - 2;

    return (
      <Pressable onPress={() => handleOpenReactions(post)} cursor="default">
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
                      emojiInput={reaction.value}
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
    <XStack alignItems="center">
      <Pressable
        borderRadius="$m"
        onLongPress={() => handleOpenReactions(post)}
        cursor="default"
      >
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
                    borderRadius="$m"
                    borderColor={
                      reaction.value === reactionDetails.self.value
                        ? '$positiveBorder'
                        : '$border'
                    }
                    gap={'$s'}
                    disabled={
                      reactionDetails.self.didReact &&
                      reaction.value !== reactionDetails.self.value
                    }
                  >
                    <SizableEmoji
                      key={reaction.value}
                      emojiInput={reaction.value}
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
                  <Text size="$label/m">
                    {firstThreeReactionUsers(reaction)}
                  </Text>
                </Tooltip.Content>
              </Tooltip>
            </Pressable>
          ))}
        </XStack>
      </Pressable>

      {post.type !== 'chat' && post.type !== 'reply' ? (
        <>
          <Pressable onPress={() => setSheetOpen(true)}>
            <View
              justifyContent="center"
              alignItems="center"
              backgroundColor="$secondaryBackground"
              padding="$xs"
              paddingHorizontal="$s"
              marginLeft={reactionDetails.list.length > 0 ? '$s' : 0}
              height="$3xl"
              borderRadius="$m"
              borderColor="$border"
              disableOptimization // height is wrong if optimized
            >
              <Icon type="React" />
            </View>
          </Pressable>
          <EmojiPickerSheet
            open={sheetOpen}
            onOpenChange={() => setSheetOpen(false)}
            onEmojiSelect={handleSelectEmoji}
          />
        </>
      ) : null}
    </XStack>
  );
}
