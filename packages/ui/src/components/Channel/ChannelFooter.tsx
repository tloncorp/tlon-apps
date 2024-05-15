import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft, Search } from '../../assets/icons';
import { Spinner, Text, View, XStack } from '../../core';
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
        // borderTopWidth={1}
        // borderTopColor="$border"
        // height="$4xl"
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
          {/* <SizableText
            flexShrink={1}
            numberOfLines={1}
            color="$primaryText"
            size="$m"
            fontWeight="500"
          >
            {title}
          </SizableText> */}
          {/* </XStack> */}
          {/* <XStack gap="$m" alignItems="center"> */}
          {showSpinner && <Spinner />}
          {showPickerButton && (
            <Button onPress={goToChannels} size="$s">
              <Icon size="$s" type="Channel" marginRight="$s" />
              <Text>{title}</Text>
            </Button>
            // <IconButton onPress={goToChannels}>
            //
            // </IconButton>
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
