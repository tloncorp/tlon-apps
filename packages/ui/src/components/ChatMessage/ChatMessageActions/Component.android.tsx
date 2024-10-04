import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { RefObject, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { EmojiToolbar } from './EmojiToolbar';
import MessageActions from './MessageActions';
import { MessageContainer } from './MessageContainer';

export function ChatMessageActions({
  post,
  postActionIds,
  onDismiss,
  onReply,
  onEdit,
  onViewReactions,
}: {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  postRef: RefObject<RNView>;
  onDismiss: () => void;
  onReply?: (post: db.Post) => void;
  onViewReactions?: (post: db.Post) => void;
  onEdit?: () => void;
}) {
  const [topOffset, setTopOffset] = useState(0);
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;

  function handleLayout(event: LayoutChangeEvent) {
    const { height } = event.nativeEvent.layout;
    const verticalPosition = calcVerticalPosition(height);
    setTopOffset(verticalPosition);
  }

  function calcVerticalPosition(height: number): number {
    const screenHeight = Dimensions.get('window').height;
    const safeTop = insets.top + PADDING_THRESHOLD;
    const safeBottom = screenHeight - insets.bottom - PADDING_THRESHOLD;
    const availableHeight = safeBottom - safeTop;

    const centeredPosition = (availableHeight - height) / 2 + safeTop;

    return Math.min(Math.max(centeredPosition, safeTop), safeBottom - height);
  }

  useEffect(() => {
    // on mount, give initial haptic feeedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 200 }}
    >
      <View
        position="absolute"
        top={topOffset}
        onLayout={handleLayout}
        paddingHorizontal="$xl"
      >
        <YStack gap="$xs">
          <EmojiToolbar post={post} onDismiss={onDismiss} />
          <MessageContainer post={post} />
          <MessageActions
            post={post}
            postActionIds={postActionIds}
            dismiss={onDismiss}
            onReply={onReply}
            onEdit={onEdit}
            onViewReactions={onViewReactions}
          />
        </YStack>
      </View>
    </MotiView>
  );
}
