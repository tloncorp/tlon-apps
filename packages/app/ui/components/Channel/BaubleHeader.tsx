import { LinearGradient } from '@tamagui/linear-gradient';
import { useConnectionStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { BlurView } from 'expo-blur';
import { useCallback, useMemo } from 'react';
import { OpaqueColorValue } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Spinner, Text, View } from 'tamagui';

import { useChatOptions } from '../../contexts/chatOptions';
import { useScrollContext } from '../../contexts/scroll';
import { useGroupTitle } from '../../utils';
import { ContactAvatar } from '../Avatar';

export function BaubleHeader({
  showSpinner,
  showIcon = true,
  group,
  channel,
}: {
  showIcon?: boolean;
  channel: db.Channel;
  showSpinner?: boolean;
  group?: db.Group | null;
}) {
  const chatOptions = useChatOptions();
  const [scrollValue] = useScrollContext();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const groupTitle = useGroupTitle(group);
  const connectionStatus = useConnectionStatus();

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
    return {
      transform: [{ translateY: shownAmount.value * -(insets.top * 0.2) }],
      opacity: opacity,
    };
  }, [easedValue, insets.top]);

  const handlePress = useCallback(() => {
    if (group) {
      chatOptions.open(group.id, 'group');
    } else {
      chatOptions.open(channel.id, 'channel');
    }
  }, [channel.id, group, chatOptions]);

  const connectionOpacity = useMemo(
    () => (connectionStatus === 'Connected' ? 1 : 0.5),
    [connectionStatus]
  );

  return (
    <View
      height={insets.top}
      position="absolute"
      zIndex={50}
      width={frame.width}
    >
      <LinearGradient
        colors={['$background', '$transparentBackground']}
        style={{ height: insets.top }}
      />
      {showIcon && (
        <Animated.View
          style={[
            {
              opacity: connectionOpacity,
              position: 'absolute',
              top: insets.top,
              left: frame.width / 2 - 24,
            },
            animatedStyle,
          ]}
        >
          <Pressable
            borderWidth={1}
            borderColor={'$border'}
            borderRadius="$l"
            overflow="hidden"
            onPress={handlePress}
            opacity={connectionOpacity}
          >
            <BlurView intensity={32}>
              {showSpinner ? (
                <Animated.View
                  entering={FadeIn.duration(128)}
                  exiting={FadeOut.duration(128)}
                >
                  <Spinner margin={'$l'} />
                </Animated.View>
              ) : null}
              {channel.members && channel.type === 'dm' && !showSpinner && (
                <Animated.View
                  entering={FadeIn.duration(128)}
                  exiting={FadeOut.duration(128)}
                >
                  <View margin="$s">
                    <ContactAvatar
                      contactId={channel.members?.[0].contactId}
                      borderRadius="$xs"
                      size="$3xl"
                    />
                  </View>
                </Animated.View>
              )}
              {channel.type === 'groupDm' && !showSpinner && (
                <Animated.View
                  entering={FadeIn.duration(128)}
                  exiting={FadeOut.duration(128)}
                >
                  <Icon
                    type={'ChannelTalk'}
                    color="$secondaryText"
                    margin="$s"
                  />
                </Animated.View>
              )}
              {(channel.type === 'chat' ||
                channel.type === 'gallery' ||
                channel.type === 'notebook') &&
                group?.iconImage &&
                !showSpinner && (
                  <Animated.View
                    entering={FadeIn.duration(128)}
                    exiting={FadeOut.duration(128)}
                  >
                    <Image
                      margin="$s"
                      width={'$3xl'}
                      height={'$3xl'}
                      borderRadius="$xs"
                      contentFit="cover"
                      source={{
                        uri: group.iconImage,
                      }}
                    />
                  </Animated.View>
                )}
              {(channel.type === 'chat' ||
                channel.type === 'gallery' ||
                channel.type === 'notebook') &&
                !group?.iconImage &&
                group?.iconImageColor &&
                !showSpinner && (
                  <Animated.View
                    entering={FadeIn.duration(128)}
                    exiting={FadeOut.duration(128)}
                  >
                    <ListItemTextIcon
                      fallbackText={groupTitle ?? ''}
                      backgroundColor={
                        group?.iconImageColor as unknown as OpaqueColorValue
                      }
                    />
                  </Animated.View>
                )}
            </BlurView>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const ListItemTextIcon = ({
  fallbackText,
  backgroundColor,
}: {
  fallbackText: string;
  backgroundColor?: OpaqueColorValue;
}) => {
  return (
    <View
      height="$3xl"
      width="$3xl"
      backgroundColor={backgroundColor ? backgroundColor : '$background'}
      justifyContent="center"
      margin="$s"
      borderRadius="$3xl"
      alignItems="center"
    >
      <Text fontSize={16} color="$primaryText">
        {fallbackText.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
};
