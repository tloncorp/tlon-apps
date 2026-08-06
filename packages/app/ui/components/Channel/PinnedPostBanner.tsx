import * as db from '@tloncorp/shared/db';
import { Icon, Text } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { XStack } from 'tamagui';

import { useConversationScrollViewNativeID } from '../../contexts/scroll';
import { GlassSurface } from '../GlassSurface';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import {
  floatingPinnedPostBannerGap,
  floatingPinnedPostBannerHeight,
} from '../conversationScrollChrome';

interface PinnedPostBannerProps {
  post: db.Post;
  floating: boolean;
  floatingHeaderHeight: number;
  onPressPost: (post: db.Post) => void;
  onDismiss: () => void;
}

export function PinnedPostBanner({
  post,
  floating,
  floatingHeaderHeight,
  onPressPost,
  onDismiss,
}: PinnedPostBannerProps) {
  const author = post.author || null;
  const previewText = post.textContent?.trim() || 'Pinned post';

  return (
    <PinnedPostBannerChrome
      floating={floating}
      floatingHeaderHeight={floatingHeaderHeight}
    >
      <Pressable onPress={() => onPressPost(post)} style={styles.post}>
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
          onDismiss();
        }}
        hitSlop={12}
      >
        <Icon type="Close" customSize={[16, 14]} color="$tertiaryText" />
      </Pressable>
    </PinnedPostBannerChrome>
  );
}

function PinnedPostBannerChrome({
  children,
  floating,
  floatingHeaderHeight,
}: PropsWithChildren<{ floating: boolean; floatingHeaderHeight: number }>) {
  const scrollViewNativeID = useConversationScrollViewNativeID();
  const usesFloatingChrome = Platform.OS === 'ios' && floating;
  const content = (
    <XStack
      height={floatingPinnedPostBannerHeight}
      paddingHorizontal="$l"
      backgroundColor={usesFloatingChrome ? 'transparent' : '$background'}
      borderBottomWidth={usesFloatingChrome ? 0 : 1}
      borderBottomColor="$border"
      alignItems="center"
      gap="$m"
    >
      {children}
    </XStack>
  );

  if (!usesFloatingChrome) {
    return content;
  }

  return (
    <ScrollEdgeElementContainer
      edge="top"
      scrollViewNativeID={scrollViewNativeID}
      style={[
        styles.floating,
        {
          top: floatingHeaderHeight + floatingPinnedPostBannerGap,
        },
      ]}
    >
      <GlassSurface glassEffectStyle="regular" style={styles.chrome}>
        {content}
      </GlassSurface>
    </ScrollEdgeElementContainer>
  );
}

const styles = StyleSheet.create({
  post: {
    flex: 1,
  },
  floating: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  chrome: {
    borderRadius: 22,
    overflow: 'hidden',
  },
});
