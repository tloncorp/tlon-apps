import * as db from '@tloncorp/shared/dist/db';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OpaqueColorValue } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemeName } from 'tamagui';

import { Image, Spinner, Text, View, XStack } from '../../core';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';

export function ChannelHeader({
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
  const themeName = useThemeName();
  const isDarkMode = themeName === 'dark';
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View zIndex={50} position="absolute" flex={1} width={'100%'}>
      <LinearGradient
        colors={[
          theme.background.val,
          isDarkMode ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)',
        ]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '80%',
        }}
      />
      <XStack
        justifyContent="space-around"
        alignItems="center"
        paddingTop={insets.top}
      >
        {showIcon && (
          <Animated.View
            entering={FadeInUp.duration(128)}
            exiting={FadeOutUp.duration(128)}
          >
            <View
              borderWidth={1}
              borderColor={'$border'}
              borderRadius="$3xl"
              overflow="hidden"
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
                      <Avatar
                        contact={channel.members?.[0].contact}
                        contactId={channel.members?.[0].contactId}
                        borderRadius="$3xl"
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
                        borderRadius="$3xl"
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
                        fallbackText={group?.title ?? ''}
                        backgroundColor={
                          group?.iconImageColor as unknown as OpaqueColorValue
                        }
                      />
                    </Animated.View>
                  )}
              </BlurView>
            </View>
          </Animated.View>
        )}
      </XStack>
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
