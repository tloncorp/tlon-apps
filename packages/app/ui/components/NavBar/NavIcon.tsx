// tamagui-ignore
import { Icon, IconType } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { View } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { Circle, ColorTokens, isWeb } from 'tamagui';

import { ContactAvatar } from '../Avatar';

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
        paddingTop: '$s',
      };

  return (
    <Pressable
      testID="AvatarNavIcon"
      flex={1}
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
  const props: Omit<ComponentProps<typeof Pressable>, 'children'> = isWeb
    ? {
        pressStyle: { backgroundColor: '$activeBorder' },
        hoverStyle: { backgroundColor: '$secondaryBackground' },
      }
    : {
        pressStyle: { backgroundColor: 'unset' },
      };
  return (
    <Pressable
      testID={testID}
      alignItems="center"
      flex={1}
      onPress={onPress}
      borderRadius="$s"
      backgroundColor={backgroundColor}
      {...props}
    >
      <Icon
        type={resolvedType}
        color={isActive ? '$primaryText' : '$tertiaryText'}
      />
      {shouldShowUnreads ? (
        <View
          position="absolute"
          top="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Circle
            size="$s"
            backgroundColor={hasUnreads ? '$blue' : 'transparent'}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
