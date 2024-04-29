import * as db from '@tloncorp/shared/dist/db';
import * as Haptics from 'expo-haptics';
import { RefObject, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, View as RNView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, YStack } from '../../../core';
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
  currentUserId,
  postRef,
  channelType,
  onDismiss,
}: {
  post: db.Post;
  currentUserId: string;
  postRef: RefObject<RNView>;
  channelType: db.ChannelType;
  onDismiss: () => void;
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
    // on mount, give initial haptic feeedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  return (
    <Animated.View style={animatedStyles}>
      <View onLayout={handleLayout} paddingHorizontal="$xl">
        <YStack gap="$xs">
          <EmojiToolbar
            post={post}
            onDismiss={onDismiss}
            currentUserId={currentUserId}
          />
          <MessageContainer post={post} currentUserId={currentUserId} />
          <MessageActions
            post={post}
            channelType={channelType}
            dismiss={onDismiss}
          />
        </YStack>
      </View>
    </Animated.View>
  );
}
