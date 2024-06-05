import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Channel as ChannelIcon,
  ChevronLeft,
  Search,
} from '../../assets/icons';
import { SizableText, View, XStack } from '../../core';
import { IconButton } from '../IconButton';

export function ChannelHeader({
  title,
  goBack,
  goToChannels,
  goToSearch,
  showPickerButton,
  showSpinner,
  showSearchButton = true,
}: {
  title: string;
  goBack?: () => void;
  goToChannels?: () => void;
  goToSearch?: () => void;
  showPickerButton?: boolean;
  showSpinner?: boolean;
  showSearchButton?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View paddingTop={insets.top}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$xl"
        gap="$m"
        height="$3xl"
        paddingBottom="$m"
      >
        <XStack alignItems="center" gap="$m" flex={1}>
          <IconButton onPress={goBack}>
            <ChevronLeft />
          </IconButton>
          <Animated.View
            key={showSpinner?.toString()}
            entering={FadeInDown}
            exiting={FadeOutUp}
            style={{ flex: 1 }}
          >
            <SizableText
              flexShrink={1}
              numberOfLines={1}
              color="$primaryText"
              size="$m"
              fontWeight="500"
            >
              {showSpinner ? 'Loading…' : title}
            </SizableText>
          </Animated.View>
        </XStack>
        <XStack gap="$m" alignItems="center">
          {showSearchButton && (
            <IconButton onPress={goToSearch}>
              <Search />
            </IconButton>
          )}
          {showPickerButton && (
            <IconButton onPress={goToChannels}>
              <ChannelIcon />
            </IconButton>
          )}
        </XStack>
      </XStack>
    </View>
  );
}
