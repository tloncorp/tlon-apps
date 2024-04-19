import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, XStack, YStack } from '../../core';
import { ReactionDetails, useReactionDetails } from '../../utils/postUtils';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import { EmojiPickerSheet } from '../Emoji/EmojiPickerSheet';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Icon } from '../Icon';
import ChatMessageActionsList from './ChatMessageActionsList';

interface Measurement {
  x: number;
  y: number;
  height: number;
  width: number;
}

export function ChatMessageActions({
  post,
  currentUserId,
  channelType,
  originalMessageLayout,
  onDismiss,
}: {
  post: db.PostWithRelations;
  currentUserId: string;
  originalMessageLayout: Measurement;
  channelType: db.ChannelType;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;
  const MESSAGE_OFFSET_FROM_CONTAINER_TOP = 70;

  const [actionLayout, setActionLayout] = useState<Measurement | null>(null);
  const [translateY, setTranslateY] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width, x, y } = event.nativeEvent.layout;
    setActionLayout({ x, y, height, width });
  }

  useEffect(() => {
    if (actionLayout && originalMessageLayout) {
      let newY = originalMessageLayout.y - MESSAGE_OFFSET_FROM_CONTAINER_TOP;
      const totalHeight = actionLayout.height;
      const screenHeight = Dimensions.get('window').height;

      // Adjust newY to ensure the component does not clip off the bottom of the screen
      if (
        newY + totalHeight >
        screenHeight - insets.bottom - PADDING_THRESHOLD
      ) {
        newY = screenHeight - insets.bottom - totalHeight - PADDING_THRESHOLD;
      }

      // Adjust newY to ensure the component does not clip off the top of the screen
      if (newY < insets.top + PADDING_THRESHOLD) {
        newY = insets.top + PADDING_THRESHOLD;
      }

      // Update translateY to move the component to newY
      setTranslateY(newY);
    }
  });

  return (
    <>
      <MotiView
        delay={200}
        from={{
          translateX: 0,
          translateY:
            originalMessageLayout.y - MESSAGE_OFFSET_FROM_CONTAINER_TOP,
          opacity: 0,
        }}
        animate={{
          translateX: 0,
          translateY: translateY,
          opacity: 1,
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 400,
          mass: 1,
        }}
      >
        <View onLayout={handleLayout} paddingHorizontal="$xl">
          <YStack gap="$xs">
            <EmojiToolbar
              post={post}
              onDismiss={onDismiss}
              currentUserId={currentUserId}
            />
            <MessageContainer post={post} currentUserId={currentUserId} />

            <MotiView
              from={{
                scale: 0,
                opacity: 0,
              }}
              animate={{ scale: 1, opacity: 1, translateX: 0, translateY: 0 }}
              transition={{
                type: 'timing',
                duration: 100,
                delay: 250,
              }}
              style={{ transformOrigin: 'top left' }}
            >
              <ChatMessageActionsList
                post={post}
                channelType={channelType}
                dismiss={onDismiss}
              />
            </MotiView>
          </YStack>
        </View>
      </MotiView>
    </>
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
      ? store.removePostReaction(post, currentUserId)
      : store.addPostReaction(post, shortCode, currentUserId);

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
    <MotiView
      from={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      exit={{ scaleX: 0, opacity: 0 }}
      transition={{
        type: 'timing',
        duration: 100,
        delay: 250,
      }}
      style={{ transformOrigin: 'left' }}
    >
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
    </MotiView>
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
  const [isPressed, setIsPressed] = useState(false);
  const onPress = useCallback(() => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    setTimeout(() => handlePress(shortCode), 300);
  }, []);

  return (
    <MotiView
      from={{ scale: 0 }}
      animate={{ scale: isPressed ? 1.25 : 1 }}
      transition={{
        type: 'spring',
        stiffness: 150,
        damping: 10,
        mass: 0.5,
        delay: isPressed ? 0 : 300,
      }}
    >
      <Button
        padding="$xs"
        borderWidth={0}
        backgroundColor={
          details.self.didReact && details.self.value.includes(shortCode)
            ? '$blueSoft'
            : undefined
        }
        onPress={onPress}
      >
        <SizableEmoji shortCode={shortCode} fontSize={32} />
      </Button>
    </MotiView>
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
