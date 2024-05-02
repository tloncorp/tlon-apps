import { MotiView } from 'moti';
import { PropsWithChildren, useState } from 'react';
import { DimensionValue, Dimensions, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStackProps, styled, withStaticProperties } from 'tamagui';

import { Modal, Text, View, XStack, YStack } from '../../core';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

const EmbedTitle = styled(Text, {
  fontSize: '$s',
  color: '$secondaryText',
});

function EmbedPopOutIcon() {
  return <Icon type="ArrowRef" color="$tertiaryText" size="$m" />;
}

function EmbedHeader({
  children,
  onPress,
}: PropsWithChildren<{ onPress: () => void }>) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        gap="$s"
        alignItems="center"
        padding="$l"
        justifyContent="space-between"
        borderBottomColor="$border"
        borderBottomWidth={1}
      >
        {children}
      </XStack>
    </Pressable>
  );
}

function EmbedPreview({
  children,
  onPress,
}: PropsWithChildren<{ onPress: () => void }>) {
  return (
    <Pressable onPress={onPress}>
      <XStack gap="$s" alignItems="center" padding="$l">
        {children}
      </XStack>
    </Pressable>
  );
}

function EmbedModal({
  visible,
  onDismiss,
  onPress,
  children,
  height,
  width,
}: PropsWithChildren<{
  visible: boolean;
  onDismiss: () => void;
  onPress?: () => void;
  height?: DimensionValue;
  width?: DimensionValue;
}>) {
  const insets = useSafeAreaInsets();
  const [topOffset, setTopOffset] = useState(0);
  const [leftOffset, setLeftOffset] = useState(0);
  const PADDING_THRESHOLD = 40;

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    const verticalPosition = calcVerticalPosition(height);
    const horizontalPosition = calcHorizontalPosition(width);
    setTopOffset(verticalPosition);
    setLeftOffset(horizontalPosition);
  }

  function calcHorizontalPosition(width: number): number {
    const screenWidth = Dimensions.get('window').width;
    const safeLeft = insets.left + PADDING_THRESHOLD;
    const safeRight = screenWidth - insets.right - PADDING_THRESHOLD;
    const availableWidth = safeRight - safeLeft;

    return Math.min(
      Math.max((availableWidth - width) / 2 + safeLeft, safeLeft),
      safeRight - width
    );
  }

  function calcVerticalPosition(height: number): number {
    const screenHeight = Dimensions.get('window').height;
    const safeTop = insets.top + PADDING_THRESHOLD;
    const safeBottom = screenHeight - insets.bottom - PADDING_THRESHOLD;
    const availableHeight = safeBottom - safeTop;

    const centeredPosition = (availableHeight - height) / 2 + safeTop;

    return Math.min(Math.max(centeredPosition, safeTop), safeBottom - height);
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        delay={150}
        transition={{ duration: 300 }}
      >
        <View
          position="absolute"
          top={topOffset}
          left={leftOffset}
          onLayout={handleLayout}
          // if we need to set a height and width we need
          // to pass it here so onLayout can calculate the position
          height={height}
          width={width}
          paddingHorizontal="$xl"
        >
          <Pressable onPress={onPress}>
            <XStack
              backgroundColor="$background"
              gap="$s"
              alignItems="center"
              padding="$l"
              borderRadius="$s"
              // we need to set height and width here as well
              // because the parent view for our webviews requires it
              height={height}
              width={width}
            >
              {children}
            </XStack>
          </Pressable>
        </View>
      </MotiView>
    </Modal>
  );
}

function EmbedFrame({ children, ...props }: PropsWithChildren<YStackProps>) {
  return (
    <YStack
      gap="$s"
      borderRadius="$s"
      padding={0}
      borderColor="$border"
      borderWidth={1}
      justifyContent="center"
      width={200}
      height={120}
      {...props}
    >
      {children}
    </YStack>
  );
}

export const Embed = withStaticProperties(EmbedFrame, {
  Header: EmbedHeader,
  Preview: EmbedPreview,
  Modal: EmbedModal,
  Title: EmbedTitle,
  PopOutIcon: EmbedPopOutIcon,
});
