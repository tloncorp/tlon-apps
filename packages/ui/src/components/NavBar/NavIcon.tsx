import { Circle, ColorTokens } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { Icon, IconType } from '../Icon';
import Pressable from '../Pressable';
import { View } from '../View';

export function AvatarNavIcon({
  id,
  focused,
  onPress,
}: {
  id: string;
  focused: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable flex={1} onPress={onPress} alignItems="center" paddingTop={'$s'}>
      <ContactAvatar
        size={'custom'}
        width={20}
        height={20}
        borderRadius={3}
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
      backgroundColor={backgroundColor}
      alignItems="center"
      flex={1}
      onPress={onPress}
    >
      <Icon
        type={resolvedType}
        color={isActive ? '$primaryText' : '$activeBorder'}
      />
      {shouldShowUnreads ? (
        <View justifyContent="center" alignItems="center">
          <Circle
            size="$s"
            backgroundColor={hasUnreads ? '$blue' : 'transparent'}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
