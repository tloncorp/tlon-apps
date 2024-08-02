import { Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft } from '../assets/icons';
import { SizableText, View, XStack } from '../core';
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
            <IconButton onPress={goBack}>
              <Icon type="ChevronLeft" size="$xl" />
            </IconButton>
          )}
          {Platform.OS === 'web' ? (
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
