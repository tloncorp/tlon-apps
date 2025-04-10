import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { IconButton } from '@tloncorp/ui';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, Spinner, XStack } from 'tamagui';

import { useScrollContext } from '../../contexts/scroll';

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
  const [scrollValue] = useScrollContext();
  const easedValue = useDerivedValue(
    () => Easing.ease(scrollValue.value),
    [scrollValue]
  );

  const shownAmount = useDerivedValue(
    () =>
      withTiming(scrollValue.value > 0.5 ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      }),
    [scrollValue]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shownAmount.value, [0, 1], [1, 0]);
    const height = interpolate(
      shownAmount.value,
      [0, 1],
      [insets.bottom + 50, 0]
    );

    return {
      transform: [{ translateY: shownAmount.value * -(insets.top * 0.2) }],
      opacity: opacity,
      height: height,
    };
  }, [shownAmount.value, insets.top]);

  return (
    <Animated.View style={[{ flex: 0 }, animatedStyle]}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingVertical="$m"
        paddingBottom={insets.bottom}
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
            <Icon type="ChevronLeft" />
          </IconButton>
          {showSpinner && <Spinner />}
          {showPickerButton && (
            <Button
              onPress={goToChannels}
              paddingHorizontal="$m"
              paddingVertical="$s"
              alignItems="center"
            >
              <Icon
                size="$s"
                type="Channel"
                marginRight="$s"
                color="$secondaryText"
              />
              <SizableText
                ellipsizeMode="tail"
                numberOfLines={1}
                fontSize={'$s'}
                maxWidth={200}
                height={'$2xl'}
                color="$secondaryText"
              >
                {title}
              </SizableText>
            </Button>
          )}
          {showSearchButton && (
            <IconButton onPress={goToSearch} color={'$secondaryText'}>
              <Icon type="Search" />
            </IconButton>
          )}
        </XStack>
      </XStack>
    </Animated.View>
  );
}
