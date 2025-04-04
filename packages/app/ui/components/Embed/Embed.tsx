import { Icon, Modal, Pressable, Text } from '@tloncorp/ui';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import {
  ComponentProps,
  PropsWithChildren,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { DimensionValue, Dimensions, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, styled, withStaticProperties } from 'tamagui';

const EmbedFrame = styled(YStack, {
  name: 'EmbedFrame',
  borderRadius: '$s',
  padding: 0,
  borderColor: '$border',
  borderWidth: 1,
  justifyContent: 'center',
  backgroundColor: '$secondaryBackground',
});

const EmbedHeader = styled(XStack, {
  name: 'EmbedHeader',
  gap: '$s',
  alignItems: 'center',
  paddingLeft: '$l',
  paddingRight: '$l',
  paddingVertical: '$s',
  justifyContent: 'space-between',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
});

const EmbedPreview = styled(YStack, {
  name: 'EmbedPreview',
  gap: '$s',
  padding: '$l',
  width: '100%',
});

const EmbedTitle = styled(Text, {
  name: 'EmbedTitle',
  fontSize: '$s',
  color: '$tertiaryText',
});

const EmbedPopOutIcon = styled(Icon, {
  name: 'EmbedPopOutIcon',
  color: '$tertiaryText',
  size: '$s',
}).styleable(() => {
  return <Icon type="ArrowRef" color="$tertiaryText" size="$s" />;
});

const EmbedModalContent = styled(XStack, {
  name: 'EmbedModalContent',
  backgroundColor: '$background',
  gap: '$s',
  alignItems: 'center',
  padding: '$l',
  borderRadius: '$s',
});

const EmbedModalWrapper = styled(View, {
  name: 'EmbedModalWrapper',
  position: 'absolute',
  paddingHorizontal: '$xl',
});

const PADDING_THRESHOLD = 40;

const EmbedModal = memo(function EmbedModal({
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

  const calcHorizontalPosition = useCallback(
    (width: number): number => {
      const screenWidth = Dimensions.get('window').width;
      const safeLeft = insets.left + PADDING_THRESHOLD;
      const safeRight = screenWidth - insets.right - PADDING_THRESHOLD;
      const availableWidth = safeRight - safeLeft;

      return Math.min(
        Math.max((availableWidth - width) / 2 + safeLeft, safeLeft),
        safeRight - width
      );
    },
    [insets]
  );

  const calcVerticalPosition = useCallback(
    (height: number): number => {
      const screenHeight = Dimensions.get('window').height;
      const safeTop = insets.top + PADDING_THRESHOLD;
      const safeBottom = screenHeight - insets.bottom - PADDING_THRESHOLD;
      const availableHeight = safeBottom - safeTop;

      const centeredPosition = (availableHeight - height) / 2 + safeTop;

      return Math.min(Math.max(centeredPosition, safeTop), safeBottom - height);
    },
    [insets]
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      const verticalPosition = calcVerticalPosition(height);
      const horizontalPosition = calcHorizontalPosition(width);
      setTopOffset(verticalPosition);
      setLeftOffset(horizontalPosition);
    },
    [calcVerticalPosition, calcHorizontalPosition]
  );

  const animationProps = useMemo(
    () => ({
      from: { opacity: 0 },
      animate: { opacity: 1 },
      delay: 150,
      transition: { duration: 300 },
    }),
    []
  );

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <MotiView {...animationProps}>
        <EmbedModalWrapper
          top={topOffset}
          left={leftOffset}
          onLayout={handleLayout}
          height={height}
          width={width}
        >
          <Pressable onPress={onPress}>
            <EmbedModalContent height={height} width={width}>
              {children}
            </EmbedModalContent>
          </Pressable>
        </EmbedModalWrapper>
      </MotiView>
    </Modal>
  );
});

const EmbedComponent = EmbedFrame.styleable<ComponentProps<typeof EmbedFrame>>(
  ({ children, ...props }, ref) => {
    return (
      <EmbedFrame {...props} ref={ref}>
        {children}
      </EmbedFrame>
    );
  },
  {
    staticConfig: {
      componentName: 'Embed',
    },
  }
);

const EmbedThumbnail = styled(Image, {
  name: 'EmbedThumbnail',
  width: '$xl',
  height: '$xl',
  borderRadius: '$s',
  overflow: 'hidden',
  backgroundColor: '$tertiaryBackground',
});

export const Embed = withStaticProperties(EmbedComponent, {
  Header: EmbedHeader,
  Preview: EmbedPreview,
  Modal: EmbedModal,
  Title: EmbedTitle,
  PopOutIcon: EmbedPopOutIcon,
  Thumbnail: EmbedThumbnail,
});
