import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack } from 'tamagui';

import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import {
  conversationNavigationBarHeight,
  conversationScrollViewNativeID,
  floatingPinnedPostBannerGap,
  floatingPinnedPostBannerHeight,
} from '../nativeScrollEdgeEffects';
import {
  PinnedPostBannerChrome,
  usesFloatingPinnedPostBanner,
} from './PinnedPostBannerChrome';

interface PinnedPostBannerProps {
  channel: db.Channel;
  onPressPost: (post: db.Post) => void;
}

export function PinnedPostBanner({
  channel,
  onPressPost,
}: PinnedPostBannerProps) {
  const insets = useSafeAreaInsets();
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

  const content = (
    <PinnedPostBannerChrome>
      <XStack
        height={floatingPinnedPostBannerHeight}
        paddingHorizontal="$l"
        backgroundColor={
          usesFloatingPinnedPostBanner ? 'transparent' : '$background'
        }
        borderBottomWidth={usesFloatingPinnedPostBanner ? 0 : 1}
        borderBottomColor="$border"
        alignItems="center"
        gap="$m"
      >
        <Pressable onPress={handlePress} style={styles.post}>
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
    </PinnedPostBannerChrome>
  );

  if (usesFloatingPinnedPostBanner) {
    return (
      <ScrollEdgeElementContainer
        edge="top"
        scrollViewNativeID={conversationScrollViewNativeID}
        style={[
          styles.floating,
          {
            top:
              insets.top +
              conversationNavigationBarHeight +
              floatingPinnedPostBannerGap,
          },
        ]}
      >
        {content}
      </ScrollEdgeElementContainer>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  post: {
    flex: 1,
  },
});
