import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { RefObject, useCallback, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, View as RNView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import { EmojiPickerSheet } from '../Emoji/EmojiPickerSheet';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Icon } from '../Icon';
import ChatMessageMenu from './ChatMessageMenu';

interface LayoutStruct {
  x: number;
  y: number;
  height: number;
  width: number;
}

export function ChatMessageActions({
  post,
  postRef,
  channelType,
  onDismiss,
}: {
  post: db.PostWithRelations;
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
    postRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      translateX.value = pageX;
      translateY.value = pageY;
      setOriginalLayout({ x: pageX, y: pageY, width, height });
    });
  }, [postRef]);

  useEffect(() => {
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
          <EmojiToolbar post={post} onDismiss={onDismiss} />
          <MessageContainer post={post} />
          <ChatMessageMenu
            post={post}
            channelType={channelType}
            dismiss={onDismiss}
          />
        </YStack>
      </View>
    </Animated.View>
  );
}

export function EmojiToolbar({
  post,
  onDismiss,
}: {
  post: db.PostWithRelations;
  onDismiss: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasSelfReact =
    post.reactions?.reduce(
      (has, react) => has || react.contactId === (global as any).ship,
      false
    ) ?? false;

  const selfShortcode =
    post.reactions?.reduce(
      (foundValue, react) => {
        return (
          foundValue ||
          (react.contactId === (global as any).ship ? react.value : null)
        );
      },
      null as null | string
    ) ?? '';

  const handlePress = useCallback((shortCode: string) => {
    hasSelfReact && selfShortcode.includes(shortCode)
      ? store.removePostReaction(post.channelId, post.id, (global as any).ship)
      : store.addPostReaction(
          post.channelId,
          post.id,
          shortCode,
          (global as any).ship
        );

    setTimeout(() => onDismiss(), 50);
  }, []);

  console.log('sheet open?', sheetOpen);

  return (
    <>
      <XStack
        padding="$l"
        backgroundColor="$background"
        borderRadius="$l"
        justifyContent="space-between"
        alignItems="center"
        width={256}
      >
        <Button padding="$xs" borderWidth={0} onPress={() => handlePress('+1')}>
          <SizableEmoji shortCode="+1" fontSize={32} />
        </Button>
        <Button
          padding="$xs"
          borderWidth={0}
          onPress={() => handlePress('heart')}
        >
          <SizableEmoji shortCode="heart" fontSize={32} />
        </Button>
        <Button
          padding="$xs"
          borderWidth={0}
          onPress={() => handlePress('cyclone')}
        >
          <SizableEmoji shortCode="cyclone" fontSize={32} />
        </Button>
        <Button
          padding="$xs"
          borderWidth={0}
          onPress={() => handlePress('seedling')}
        >
          <SizableEmoji shortCode="seedling" fontSize={32} />
        </Button>
        <Button
          padding="$xs"
          borderWidth={0}
          onPress={() => setSheetOpen(true)}
        >
          <Icon type="ChevronDown" size="$l" />
        </Button>
      </XStack>
      <EmojiPickerSheet
        open={sheetOpen}
        onOpenChange={() => setSheetOpen(false)}
        onEmojiSelect={handlePress}
      />
    </>
  );
}

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
function MessageContainer({ post }: { post: db.PostWithRelations }) {
  const screenHeight = Dimensions.get('window').height;
  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      overflow="hidden"
      backgroundColor="$background"
      padding="$l"
      borderRadius="$l"
    >
      <ChatMessage post={post} />
    </View>
  );
}
