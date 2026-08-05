// tamagui-ignore
import { Icon, IconType } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { View } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { Circle, ColorTokens, isWeb } from 'tamagui';

import { getAndroidRoundedBackgroundKey } from '../../utils';
import { ContactAvatar } from '../Avatar';

// Match platform touch-target guidelines (iOS HIG 44pt, Android Material
// 48dp); the tab's tappable area spans its full flex share of the bar.
const NAV_TARGET_MIN_HEIGHT = Platform.OS === 'android' ? 48 : 44;

export function AvatarNavIcon({
  id,
  focused,
  onPress,
  onLongPress,
}: {
  id: string;
  focused: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const props: Omit<ComponentProps<typeof Pressable>, 'children'> = isWeb
    ? {
        width: '$3xl',
        height: '$3xl',
        justifyContent: 'center',
        pressStyle: { backgroundColor: '$activeBorder' },
        hoverStyle: { backgroundColor: '$secondaryBackground' },
      }
    : {
        pressStyle: { backgroundColor: 'unset' },
        flex: 1,
        minHeight: NAV_TARGET_MIN_HEIGHT,
        justifyContent: 'center',
      };

  return (
    <Pressable
      testID="AvatarNavIcon"
      onPress={onPress}
      onLongPress={onLongPress}
      alignItems="center"
      borderRadius="$s"
      {...props}
    >
      <ContactAvatar
        {...(isWeb
          ? { size: '$2xl' }
          : { size: 'custom', width: 20, height: 20 })}
        contactId={id}
        opacity={focused ? 1 : 0.6}
      />
    </Pressable>
  );
}

export default function NavIcon({
  testID,
  type,
  activeType,
  isActive,
  hasUnreads = false,
  onPress,
  backgroundColor,
  shouldShowUnreads = true,
}: {
  testID?: string;
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
  hasUnreads?: boolean;
  onPress?: () => void;
  backgroundColor?: ColorTokens;
  shouldShowUnreads?: boolean;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  const unreadDotBackgroundColor = hasUnreads ? '$blue' : 'transparent';
  const props: Omit<ComponentProps<typeof Pressable>, 'children'> = isWeb
    ? {
        pressStyle: { backgroundColor: '$activeBorder' },
        hoverStyle: { backgroundColor: '$secondaryBackground' },
      }
    : {
        pressStyle: { backgroundColor: 'unset' },
        flex: 1,
        minHeight: NAV_TARGET_MIN_HEIGHT,
        justifyContent: 'center',
      };
  return (
    <Pressable
      testID={testID}
      alignItems="center"
      onPress={onPress}
      borderRadius="$s"
      backgroundColor={backgroundColor}
      {...props}
    >
      <View>
        <Icon
          type={resolvedType}
          color={isActive ? '$primaryText' : '$tertiaryText'}
        />
        {shouldShowUnreads ? (
          <View
            position="absolute"
            top="100%"
            left={0}
            right={0}
            justifyContent="center"
            alignItems="center"
          >
            <Circle
              key={getAndroidRoundedBackgroundKey(unreadDotBackgroundColor)}
              size="$s"
              backgroundColor={unreadDotBackgroundColor}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
