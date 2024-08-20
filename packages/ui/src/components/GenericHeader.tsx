import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, View, XStack, isWeb } from 'tamagui';

import { Icon } from './Icon';
import { IconButton } from './IconButton';

export function GenericHeader({
  title,
  goBack,
  showSpinner,
  rightContent,
}: {
  title?: string;
  goBack?: () => void;
  showSpinner?: boolean;
  rightContent?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

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
            <IconButton onPress={goBack} backgroundColor="unset">
              <Icon type="ChevronLeft" />
            </IconButton>
          )}
          {isWeb ? (
            <View flex={1}>
              <SizableText
                flexShrink={1}
                numberOfLines={1}
                color="$primaryText"
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
                color="$primaryText"
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
