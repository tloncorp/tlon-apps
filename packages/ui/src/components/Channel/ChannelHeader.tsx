import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Channel as ChannelIcon,
  ChevronLeft,
  Search,
} from '../../assets/icons';
import { SizableText, Spinner, View, XStack } from '../../core';
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
      >
        <XStack alignItems="center" gap="$m" flex={1}>
          <IconButton onPress={goBack}>
            <ChevronLeft />
          </IconButton>
          <SizableText
            flexShrink={1}
            numberOfLines={1}
            color="$primaryText"
            size="$m"
            fontWeight="500"
          >
            {showSpinner ? 'Loading…' : title}
          </SizableText>
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
