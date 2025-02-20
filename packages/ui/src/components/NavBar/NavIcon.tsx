// tamagui-ignore
import { Circle, ColorTokens, isWeb } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { Icon, IconType } from '../Icon';
import Pressable from '../Pressable';
import { View } from '../View';

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
  return (
    <Pressable
      testID="AvatarNavIcon"
      flex={1}
      onPress={onPress}
      onLongPress={onLongPress}
      alignItems="center"
      justifyContent="center"
      width={isWeb ? '$3xl' : undefined}
      height={isWeb ? '$3xl' : undefined}
      pressStyle={{ backgroundColor: '$activeBorder' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      borderRadius="$s"
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
  type,
  activeType,
  isActive,
  hasUnreads = false,
  onPress,
  backgroundColor,
  shouldShowUnreads = true,
}: {
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
  hasUnreads?: boolean;
  onPress?: () => void;
  backgroundColor?: ColorTokens;
  shouldShowUnreads?: boolean;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  return (
    <Pressable
      alignItems="center"
      flex={1}
      onPress={onPress}
      borderRadius="$s"
      backgroundColor={backgroundColor}
      pressStyle={{ backgroundColor: '$activeBorder' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
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
