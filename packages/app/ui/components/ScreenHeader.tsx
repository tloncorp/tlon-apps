import { useConnectionStatus, useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text } from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, isWeb, styled, withStaticProperties } from 'tamagui';

export const ScreenHeaderComponent = ({
  children,
  title,
  titleWidth = 100,
  leftControls,
  rightControls,
  isLoading,
  backAction,
  showSessionStatus,
}: PropsWithChildren<{
  title?: string | ReactNode;
  titleWidth?: 100 | 75 | 55;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  isLoading?: boolean;
  backAction?: () => void;
  showSessionStatus?: boolean;
}>) => {
  const { top } = useSafeAreaInsets();
  const resolvedTitle = useDebouncedValue(isLoading ? 'Loading…' : title, 200);
  const connectionStatus = useConnectionStatus();
  const textColor =
    showSessionStatus === false
      ? '$primaryText'
      : connectionStatus !== 'Connected'
        ? '$tertiaryText'
        : '$primaryText';

  return (
    <View paddingTop={top} zIndex={50}>
      <XStack
        height="$4xl"
        paddingHorizontal="$2xl"
        paddingVertical="$l"
        alignItems="center"
        justifyContent="center"
      >
        {typeof resolvedTitle === 'string' ? (
          <HeaderTitle
            title={resolvedTitle}
            color={textColor}
            titleWidth={titleWidth}
            testID="ScreenHeaderTitle"
          />
        ) : (
          resolvedTitle
        )}
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
        cursor: 'default',
        pressStyle: {
          opacity: 1,
        },
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
  textAlign: 'center',
  width: '100%',
  paddingHorizontal: '$2xl',
  numberOfLines: 1,
});

function HeaderTitle({
  title,
  titleWidth = 100,
  ...props
}: {
  title: string;
  titleWidth?: 100 | 75 | 55;
} & ComponentProps<typeof HeaderTitleText>) {
  const renderedTitle = <HeaderTitleText {...props}>{title}</HeaderTitleText>;

  return isWeb ? (
    renderedTitle
  ) : (
    <View
      style={{
        flex: 1,
        maxWidth: `${titleWidth}%`,
      }}
    >
      {renderedTitle}
    </View>
  );
}

const HeaderControls = styled(XStack, {
  position: 'absolute',
  top: 0,
  bottom: 0,
  gap: '$xl',
  alignItems: 'center',
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
