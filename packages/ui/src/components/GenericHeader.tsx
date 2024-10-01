import { useCurrentSession } from '@tloncorp/shared';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, isWeb } from 'tamagui';

import { Button } from './Button';
import { Icon } from './Icon';

export function GenericHeader({
  title,
  goBack,
  showSpinner,
  rightContent,
  showSessionStatus,
}: {
  title?: string;
  goBack?: () => void;
  showSpinner?: boolean;
  rightContent?: React.ReactNode;
  showSessionStatus?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const currentSession = useCurrentSession();
  const textColor =
    showSessionStatus === false
      ? '$primaryText'
      : currentSession?.isReconnecting
        ? '$tertiaryText'
        : '$primaryText';

  return (
    <View paddingTop={insets.top}>
      <XStack
        alignItems="center"
        gap="$m"
        height="$4xl"
        justifyContent="space-between"
        paddingHorizontal="$xl"
        paddingVertical="$m"
      >
        <XStack
          alignItems="center"
          justifyContent={!goBack ? 'center' : undefined}
          gap="$m"
          flex={1}
        >
          {goBack && (
            <Button
              onPress={goBack}
              backgroundColor="unset"
              borderColor="transparent"
            >
              <Icon type="ChevronLeft" />
            </Button>
          )}
          {isWeb ? (
            <View flex={1}>
              <SizableText
                flexShrink={1}
                numberOfLines={1}
                color={textColor}
                size="$m"
                fontWeight="$xl"
              >
                {showSpinner ? 'Loading…' : title}
              </SizableText>
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown}
              exiting={FadeOutUp}
              style={{ flex: 1 }}
            >
              <SizableText
                flexShrink={1}
                numberOfLines={1}
                color={textColor}
                size="$m"
                fontWeight="$xl"
              >
                {showSpinner ? 'Loading…' : title}
              </SizableText>
            </Animated.View>
          )}
        </XStack>
        <XStack gap="$m" alignItems="center">
          {rightContent}
        </XStack>
      </XStack>
    </View>
  );
}
