import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft, Search } from '../../assets/icons';
import { SizableText, Spinner, View, XStack } from '../../core';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';

export function ChannelFooter({
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
    <View>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingVertical="$m"
        paddingHorizontal="$xl"
        gap="$m"
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$m"
          flex={1}
        >
          <IconButton onPress={goBack} color={'$secondaryText'}>
            <ChevronLeft />
          </IconButton>
          {showSpinner && <Spinner />}
          {showPickerButton && (
            <Button
              onPress={goToChannels}
              paddingHorizontal="$m"
              paddingVertical="$s"
            >
              <Icon size="$s" type="Channel" marginRight="$s" />
              <SizableText
                ellipsizeMode="tail"
                numberOfLines={1}
                fontSize={'$s'}
                maxWidth={200}
              >
                {title}
              </SizableText>
            </Button>
          )}
          {showSearchButton && (
            <IconButton onPress={goToSearch} color={'$secondaryText'}>
              <Search />
            </IconButton>
          )}
        </XStack>
      </XStack>
    </View>
  );
}
