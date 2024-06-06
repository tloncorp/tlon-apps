import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dots } from '../../assets/icons';
import {
  Channel as ChannelIcon,
  ChevronLeft,
  Search,
} from '../../assets/icons';
import { SizableText, View, XStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import { getPostActions } from '../ChatMessage/ChatMessageActions/MessageActions';
import { IconButton } from '../IconButton';

export function ChannelHeader({
  title,
  goBack,
  goToChannels,
  goToSearch,
  showPickerButton,
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
  post,
  channelType,
  currentUserId,
}: {
  title: string;
  goBack?: () => void;
  goToChannels?: () => void;
  goToSearch?: () => void;
  showPickerButton?: boolean;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
  channelType?: db.ChannelType;
  currentUserId?: string;
}) {
  const insets = useSafeAreaInsets();
  const [showActionSheet, setShowActionSheet] = useState(false);

  const postActions = useMemo(() => {
    if (!post || !channelType || !currentUserId) return [];
    return getPostActions(post, channelType).filter((action) => {
      switch (action.id) {
        case 'startThread':
          // if undelivered or already in a thread, don't show reply
          return false;
        case 'edit':
          // only show edit for current user's posts
          return post.authorId === currentUserId;
        // TODO: delete case should only be shown for admins or the author
        default:
          return true;
      }
    });
  }, [post, channelType, currentUserId]);

  return (
    <View paddingTop={insets.top}>
      <XStack
        alignItems="center"
        gap="$m"
        height="$4xl"
        justifyContent="space-between"
        paddingHorizontal="$xl"
        paddingVertical="$m"
      >
        <XStack
          alignItems="center"
          justifyContent={!goBack ? 'center' : undefined}
          gap="$m"
          flex={1}
        >
          {goBack && (
            <IconButton onPress={goBack}>
              <ChevronLeft />
            </IconButton>
          )}
          <Animated.View
            key={showSpinner?.toString()}
            entering={FadeInDown}
            exiting={FadeOutUp}
            style={{ flex: 1 }}
          >
            <SizableText
              flexShrink={1}
              numberOfLines={1}
              color="$primaryText"
              size="$m"
              fontWeight="500"
            >
              {showSpinner ? 'Loading…' : title}
            </SizableText>
          </Animated.View>
        </XStack>
        <XStack gap="$m" alignItems="center">
          {showSearchButton && (
            <IconButton onPress={goToSearch}>
              <Search />
            </IconButton>
          )}
          {showPickerButton && (
            <IconButton onPress={goToChannels}>
              <ChannelIcon />
            </IconButton>
          )}
          {showMenuButton && (
            <IconButton onPress={() => setShowActionSheet(true)}>
              <Dots />
            </IconButton>
          )}
        </XStack>
      </XStack>
      <ActionSheet
        open={showActionSheet}
        onOpenChange={setShowActionSheet}
        snapPointsMode="percent"
        snapPoints={[60]}
      >
        {postActions.map((action) => (
          <ActionSheet.Action key={action.id} action={() => ({})}>
            <ActionSheet.ActionTitle>{action.label}</ActionSheet.ActionTitle>
          </ActionSheet.Action>
        ))}
      </ActionSheet>
    </View>
  );
}
