import { useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text } from '@tloncorp/ui';
import { Children, PropsWithChildren, ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, styled, withStaticProperties } from 'tamagui';

export const ScreenHeaderComponent = ({
  children,
  title,
  subtitle,
  leftControls,
  rightControls,
  isLoading,
  backAction,
  borderBottom,
  onTitlePress,
}: PropsWithChildren<{
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  isLoading?: boolean;
  backAction?: () => void;
  showSessionStatus?: boolean;
  borderBottom?: boolean;
  onTitlePress?: () => void;
}>) => {
  const { top } = useSafeAreaInsets();
  const resolvedSubtitle = useDebouncedValue(
    isLoading ? 'Loading…' : subtitle,
    200
  );

  // Calculate number of action items to determine text width
  const leftControlsCount = leftControls ? Children.count(leftControls) : 0;
  const rightControlsCount = rightControls ? Children.count(rightControls) : 0;
  const backButtonCount = backAction ? 1 : 0;
  const totalActionItems =
    leftControlsCount + rightControlsCount + backButtonCount;

  // Determine maximum width based on number of action items or explicit titleWidth prop
  const getTextMaxWidth = () => {
    if (totalActionItems >= 4) return '55%';
    if (totalActionItems >= 2) return '60%';
    return '100%';
  };

  const textMaxWidth = getTextMaxWidth();

  return (
    <View
      paddingTop={top}
      zIndex={50}
      borderColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
    >
      <XStack height="$5xl" justifyContent="center" alignItems="flex-end">
        <View maxWidth={textMaxWidth}>
          {((Wrapper) => (
            <Wrapper>
              <Text
                color={'$secondaryText'}
                size="$label/s"
                numberOfLines={1}
                height={'$xl'}
                textAlign="center"
              >
                {resolvedSubtitle}
              </Text>
              <XStack
                alignItems="center"
                justifyContent="center"
                height={'$4xl'}
                gap={'$s'}
              >
                <Text
                  size={'$label/2xl'}
                  color={'$primaryText'}
                  numberOfLines={1}
                  maxWidth="100%"
                >
                  {title}
                </Text>
                {onTitlePress && (
                  <Icon type="ChevronDown" color="$primaryText" size="$s" />
                )}
              </XStack>
            </Wrapper>
          ))(
            onTitlePress
              ? ({ children }: { children: ReactNode }) => (
                  <Pressable onPress={onTitlePress}>{children}</Pressable>
                )
              : ({ children }: { children: ReactNode }) => <>{children}</>
          )}
        </View>

        <HeaderControls side="left">
          {backAction ? <HeaderBackButton onPress={backAction} /> : null}
          {leftControls}
        </HeaderControls>
        <HeaderControls flex={1} side="right">
          {rightControls}
        </HeaderControls>
        {children}
      </XStack>
    </View>
  );
};

const HeaderIconButton = styled(Icon, {
  customSize: ['$3xl', '$2xl'],
  borderRadius: '$m',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
});

const HeaderTextButton = styled(Text, {
  size: '$label/2xl',
  paddingHorizontal: '$s',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
  variants: {
    disabled: {
      true: {
        color: '$tertiaryText',
      },
    },
  },
});

const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <HeaderIconButton
      testID="HeaderBackButton"
      type="ChevronLeft"
      onPress={onPress}
    />
  );
};

const HeaderTitleText = styled(Text, {
  size: '$label/2xl',
  numberOfLines: 1,
});

const HeaderControls = styled(XStack, {
  position: 'absolute',
  top: 0,
  bottom: 0,
  paddingBottom: '$m',
  gap: '$xl',
  alignItems: 'flex-end',
  zIndex: 1,
  variants: {
    side: {
      left: {
        left: '$xl',
        justifyContent: 'flex-start',
      },
      right: {
        right: '$xl',
        justifyContent: 'flex-end',
      },
    },
  } as const,
});

export const ScreenHeader = withStaticProperties(ScreenHeaderComponent, {
  Controls: HeaderControls,
  Title: HeaderTitleText,
  BackButton: HeaderBackButton,
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
