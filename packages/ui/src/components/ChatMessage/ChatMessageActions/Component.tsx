import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { RefObject, useEffect, useState } from 'react';
import {
  DimensionValue,
  Dimensions,
  LayoutChangeEvent,
  View as RNView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import useIsWindowNarrow from '../../../hooks/useIsWindowNarrow';
import { triggerHaptic } from '../../../utils';
import { ActionSheet } from '../../ActionSheet';
import { EmojiToolbar } from './EmojiToolbar';
import MessageActions from './MessageActions';
import { MessageContainer } from './MessageContainer';

interface LayoutStruct {
  x: number;
  y: number;
  height: number;
  width: number;
}

export function ChatMessageActions({
  post,
  postRef,
  postActionIds,
  onDismiss,
  width,
  height,
  onReply,
  onEdit,
  onViewReactions,
  onShowEmojiPicker,
}: {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  postRef: RefObject<RNView>;
  onDismiss: () => void;
  width?: DimensionValue;
  height?: DimensionValue;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;

  const [actionLayout, setActionLayout] = useState<LayoutStruct | null>(null);
  const [originalLayout, setOriginalLayout] = useState<LayoutStruct | null>(
    null
  );
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.3); // Start with a smaller scale
  const opacity = useSharedValue(0);
  const isWindowNarrow = useIsWindowNarrow();

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width, x, y } = event.nativeEvent.layout;
    setActionLayout({ x, y, height, width });
  }

  function calcVerticalPosition(): number {
    if (actionLayout && originalLayout) {
      const originalCenterY = originalLayout.y + originalLayout.height / 2;
      let newY = originalCenterY - actionLayout.height / 2;

      // Ensure the entire actionLayout is within the safe screen bounds
      if (
        newY + actionLayout.height >
        Dimensions.get('window').height - insets.bottom - PADDING_THRESHOLD
      ) {
        newY =
          Dimensions.get('window').height -
          insets.bottom -
          actionLayout.height -
          PADDING_THRESHOLD; // Adjust down if overflowing
      }
      if (newY < insets.top + PADDING_THRESHOLD) {
        newY = insets.top + PADDING_THRESHOLD; // Adjust up if underflowing
      }

      return newY;
    }

    return 0;
  }

  useEffect(() => {
    triggerHaptic('sheetOpen');
  }, []);

  useEffect(() => {
    // measure the original post
    postRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      translateX.value = pageX;
      translateY.value = pageY;
      setOriginalLayout({ x: pageX, y: pageY, width, height });
    });
  }, [postRef]);

  useEffect(() => {
    // when we have both measurements, animate
    if (actionLayout && originalLayout) {
      const verticalPosition = calcVerticalPosition();

      const springConfig = {
        damping: 2000,
        stiffness: 1500,
        mass: 1,
      };
      translateY.value = withDelay(
        200,
        withSpring(verticalPosition, springConfig)
      );
      translateX.value = withDelay(150, withSpring(0, springConfig));
      scale.value = withDelay(200, withSpring(1, springConfig));
      opacity.value = withDelay(200, withSpring(1, springConfig));
    }
  }, [actionLayout, originalLayout]);

  const animatedStyles = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    }),
    [translateX, translateY, scale]
  );

  if (!isWindowNarrow) {
    return (
      <ActionSheet
        // We use an action sheet on web so that it will render within a dialog
        open
        onOpenChange={(open: boolean) => (!open ? onDismiss() : undefined)}
      >
        <YStack gap="$xs">
          <XStack justifyContent="center">
            <EmojiToolbar
              post={post}
              onDismiss={onDismiss}
              openExternalSheet={onShowEmojiPicker}
            />
          </XStack>
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
      </ActionSheet>
    );
  }

  return (
    <Animated.View style={animatedStyles}>
      <View
        width={width}
        height={height}
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
    </Animated.View>
  );
}
