import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import { XStack } from 'tamagui';

const BANNER_HEIGHT = 44;

interface PinnedPostBannerProps {
  channel: db.Channel;
  onPressPost: (post: db.Post) => void;
}

export function PinnedPostBanner({
  channel,
  onPressPost,
}: PinnedPostBannerProps) {
  const pinnedPostId = logic.getPinnedPostId(channel);
  const dismissedPinnedPostBannerIds =
    db.dismissedPinnedPostBannerIds.useValue();
  const isDismissed =
    !!pinnedPostId && dismissedPinnedPostBannerIds.includes(pinnedPostId);

  const postQuery = store.usePostReference({
    channelId: channel.id,
    postId: pinnedPostId ?? '',
    enabled: !!pinnedPostId && !isDismissed,
  });

  const handlePress = useCallback(() => {
    if (postQuery.data) {
      onPressPost(postQuery.data);
    }
  }, [postQuery.data, onPressPost]);

  const handleDismiss = useCallback(() => {
    if (pinnedPostId) {
      store.dismissPinnedPostBanner(pinnedPostId);
    }
  }, [pinnedPostId]);

  if (!pinnedPostId || !postQuery.data || isDismissed) {
    return null;
  }

  const post = postQuery.data;
  const author = post.author || null;
  const previewText = post.textContent?.trim() || 'Pinned post';

  return (
    <XStack
      height={BANNER_HEIGHT}
      paddingHorizontal="$l"
      backgroundColor="$background"
      borderBottomWidth={1}
      borderBottomColor="$border"
      alignItems="center"
      gap="$m"
    >
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        <XStack alignItems="center" gap="$m" flex={1}>
          <Icon type="Pin" customSize={[16, 16]} color="$primaryText" />
          <Text
            size="$label/s"
            color="$primaryText"
            numberOfLines={1}
            ellipsizeMode="tail"
            flex={1}
          >
            {author
              ? `${author.customNickname || author.peerNickname || author.id}: `
              : ''}
            {previewText}
          </Text>
        </XStack>
      </Pressable>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          handleDismiss();
        }}
        hitSlop={12}
      >
        <Icon type="Close" customSize={[16, 14]} color="$tertiaryText" />
      </Pressable>
    </XStack>
  );
}
