import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon, SizableEmoji, getNativeEmoji } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { Tooltip, View, XStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { triggerHaptic } from '../../utils';
import { useCanWrite } from '../../utils/channelUtils';
import { ReactionListItem, useReactionDetails } from '../../utils/postUtils';
import { useContactName } from '../ContactNameV2';
import { EmojiPickerSheet } from '../Emoji';
import {
  TOOLTIP_MAX_WIDTH_PX,
  TOOLTIP_NAME_FRAGMENT_MAX_WIDTH_PX,
  TOOLTIP_VIEWPORT_GUTTER_PX,
  getReactionTooltipDisplayPlan,
} from './reactionTooltipUtils';

// Web-only style; native receives `undefined` and falls back to the numeric maxWidth prop.
// Tamagui's stricter style typing rejects unknown CSS function strings, so cast at the
// boundary to keep the clamp web-only without leaking onto native.
const tooltipWebViewportClamp: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        maxWidth: `min(${TOOLTIP_MAX_WIDTH_PX}px, calc(100vw - ${TOOLTIP_VIEWPORT_GUTTER_PX}px))`,
      } as unknown as ViewStyle)
    : undefined;

function ReactionTooltipName({
  contactId,
  trailingComma,
}: {
  contactId: string;
  trailingComma: boolean;
}) {
  const name = useContactName({ contactId, expandLongIds: true });
  return (
    <Text
      size="$label/m"
      whiteSpace="nowrap"
      maxWidth={TOOLTIP_NAME_FRAGMENT_MAX_WIDTH_PX}
      numberOfLines={1}
    >
      {name}
      {trailingComma ? ',' : ''}
    </Text>
  );
}

function ReactionTooltipContent({ reaction }: { reaction: ReactionListItem }) {
  const { displayed, moreCount } = getReactionTooltipDisplayPlan(
    reaction.users ?? []
  );
  if (displayed.length === 0) return null;

  return (
    <Tooltip.Content
      padding="$s"
      backgroundColor="$secondaryBackground"
      borderRadius="$s"
      maxWidth={TOOLTIP_MAX_WIDTH_PX}
      style={tooltipWebViewportClamp}
    >
      <XStack
        flexWrap="wrap"
        rowGap="$2xs"
        columnGap="$xs"
        alignItems="baseline"
      >
        {displayed.map((user, i) => {
          const trailingComma = i < displayed.length - 1;
          return (
            <ReactionTooltipName
              key={user.id}
              contactId={user.id}
              trailingComma={trailingComma}
            />
          );
        })}
        {moreCount > 0 ? (
          <Text size="$label/m" whiteSpace="nowrap">
            +{moreCount} more
          </Text>
        ) : null}
      </XStack>
    </Tooltip.Content>
  );
}

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
  const channel = store.useChannel({ id: post.channelId });
  const canWrite = useCanWrite(channel.data, currentUserId);

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
      if (!canWrite) {
        return;
      }
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
      canWrite,
    ]
  );

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
            <Tooltip key={reaction.value} placement="top" delay={0} restMs={25}>
              <Tooltip.Trigger
                onPress={() => handleModifyYourReaction(reaction.value)}
                testID="ReactionDisplay-minimal"
                disabled={!canWrite}
                cursor="pointer"
              >
                <XStack justifyContent="center" alignItems="center">
                  <SizableEmoji emojiInput={reaction.value} fontSize="$s" />
                </XStack>
              </Tooltip.Trigger>
              <ReactionTooltipContent reaction={reaction} />
            </Tooltip>
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
            <Tooltip key={reaction.value} placement="top" delay={0} restMs={25}>
              <Tooltip.Trigger
                borderRadius="$s"
                cursor="pointer"
                onPress={() => handleModifyYourReaction(reaction.value)}
                testID="ReactionDisplay"
              >
                <XStack
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
                    !canWrite ||
                    (reactionDetails.self.didReact &&
                      reaction.value !== reactionDetails.self.value)
                  }
                >
                  <SizableEmoji emojiInput={reaction.value} fontSize="$s" />
                  {reaction.count > 0 && (
                    <Text size="$label/m">{reaction.count}</Text>
                  )}
                </XStack>
              </Tooltip.Trigger>
              <ReactionTooltipContent reaction={reaction} />
            </Tooltip>
          ))}
        </XStack>
      </Pressable>

      {post.type !== 'chat' && post.type !== 'reply' && canWrite ? (
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
