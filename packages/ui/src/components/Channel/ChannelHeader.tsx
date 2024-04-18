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
        paddingVertical="$m"
        paddingHorizontal="$xl"
        gap="$m"
        borderBottomWidth={1}
        borderBottomColor="$border"
        height="$4xl"
      >
        <XStack alignItems="center" gap="$m">
          <IconButton onPress={goBack}>
            <ChevronLeft />
          </IconButton>
          <SizableText color="$primaryText" size="$m">
            {title}
          </SizableText>
        </XStack>
        <XStack gap="$m" alignItems="center">
          {showSpinner && <Spinner />}
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
