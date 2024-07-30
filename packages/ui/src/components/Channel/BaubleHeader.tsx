import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { BlurView } from 'expo-blur';
import { useCallback, useState } from 'react';
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

import { useScrollContext } from '../../contexts/scroll';
import { Image, LinearGradient, Spinner, Text, View } from '../../core';
import { ContactAvatar } from '../Avatar';
import { ChatOptionsSheet } from '../GroupOptionsSheet';
import { Icon } from '../Icon';

export function BaubleHeader({
  showSpinner,
  showIcon = true,
  group,
  channel,
  currentUserId,
  pinned,
  useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvitesAndPrivacy,
  onPressRoles,
  onPressLeave,
  onTogglePinned,
}: {
  showIcon?: boolean;
  channel: db.Channel;
  showSpinner?: boolean;
  group?: db.Group | null;
  currentUserId: string;
  pinned: db.Channel[];
  useGroup: typeof store.useGroup;
  onPressGroupMeta: () => void;
  onPressGroupMembers: () => void;
  onPressManageChannels: () => void;
  onPressInvitesAndPrivacy: () => void;
  onPressRoles: () => void;
  onPressLeave: () => void;
  onTogglePinned: () => void;
}) {
  const [scrollValue] = useScrollContext();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();

  const [showChatOptions, setShowChatOptions] = useState(false);

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

  const handleAction = useCallback((action: () => void) => {
    setShowChatOptions(false);
    action();
  }, []);

  const handleChatOptionsOpenChange = useCallback((open: boolean) => {
    setShowChatOptions(open);
  }, []);

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
              opacity: 1,
              position: 'absolute',
              top: insets.top,
              left: frame.width / 2 - 24,
            },
            animatedStyle,
          ]}
        >
          <View
            borderWidth={1}
            borderColor={'$border'}
            borderRadius="$l"
            overflow="hidden"
            onPress={() => setShowChatOptions(true)}
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
      <ChatOptionsSheet
        open={showChatOptions}
        onOpenChange={handleChatOptionsOpenChange}
        currentUser={currentUserId}
        pinned={pinned}
        group={group ?? undefined}
        useGroup={useGroup}
        onPressGroupMeta={() => handleAction(() => onPressGroupMeta())}
        onPressGroupMembers={() => handleAction(() => onPressGroupMembers())}
        onPressManageChannels={() =>
          handleAction(() => onPressManageChannels())
        }
        onPressInvitesAndPrivacy={() =>
          handleAction(() => onPressInvitesAndPrivacy())
        }
        onPressRoles={() => handleAction(() => onPressRoles())}
        onPressLeave={() => handleAction(onPressLeave)}
        onTogglePinned={() => handleAction(onTogglePinned)}
      />
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
