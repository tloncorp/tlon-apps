import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
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
import { ReactionDetails, useReactionDetails } from '../../utils/postUtils';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import { EmojiPickerSheet } from '../Emoji/EmojiPickerSheet';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Icon } from '../Icon';
import ChatMessageActionsList from './ChatMessageActionsList';

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
  post: db.PostWithRelations;
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          <ChatMessageActionsList
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
  currentUserId,
  onDismiss,
}: {
  post: db.PostWithRelations;
  currentUserId: string;
  onDismiss: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const details = useReactionDetails(post.reactions ?? [], currentUserId);

  const handlePress = useCallback(async (shortCode: string) => {
    details.self.didReact && details.self.value.includes(shortCode)
      ? store.removePostReaction(post.channelId, post.id, currentUserId)
      : store.addPostReaction(
          post.channelId,
          post.id,
          shortCode,
          currentUserId
        );

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => onDismiss(), 50);
  }, []);

  const lastShortCode =
    details.self.didReact &&
    !['+1', 'heart', 'cyclone', 'seedling'].some((code) =>
      details.self.value.includes(code)
    )
      ? details.self.value
      : 'seedling';

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
        <EmojiToolbarButton
          details={details}
          shortCode="+1"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode="heart"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode="cyclone"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handlePress}
        />
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

function EmojiToolbarButton({
  shortCode,
  details,
  handlePress,
}: {
  shortCode: string;
  details: ReactionDetails;
  handlePress: (shortCode: string) => void;
}) {
  return (
    <Button
      padding="$xs"
      borderWidth={0}
      backgroundColor={
        details.self.didReact && details.self.value.includes(shortCode)
          ? '$positiveBackground'
          : undefined
      }
      onPress={() => handlePress(shortCode)}
    >
      <SizableEmoji shortCode={shortCode} fontSize={32} />
    </Button>
  );
}

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.3;
function MessageContainer({
  post,
  currentUserId,
}: {
  post: db.PostWithRelations;
  currentUserId: string;
}) {
  const screenHeight = Dimensions.get('window').height;
  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      overflow="hidden"
      backgroundColor="$background"
      padding="$l"
      borderRadius="$l"
    >
      <ChatMessage post={post} currentUserId={currentUserId} />
    </View>
  );
}
