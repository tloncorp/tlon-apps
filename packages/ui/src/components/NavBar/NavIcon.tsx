import { Contact } from '@tloncorp/shared/dist/db';

import { Circle } from '../../core/tamagui';
import { Avatar } from '../Avatar';
import { Icon, IconType } from '../Icon';
import { View } from '../View';

export function AvatarNavIcon({
  id,
  focused,
  contact,
  isLoading,
  onPress,
}: {
  id: string;
  focused: boolean;
  contact: Contact;
  isLoading: boolean;
  onPress?: () => void;
}) {
  return isLoading && !contact ? null : (
    <View flex={1} onPress={onPress} alignItems="center" paddingTop={'$s'}>
      <Avatar
        width={20}
        height={20}
        borderRadius={3}
        contact={contact}
        contactId={id}
        opacity={focused ? 1 : 0.6}
      />
    </View>
  );
}

export default function NavIcon({
  type,
  activeType,
  isActive,
  hasUnreads = false,
  onPress,
}: {
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
  hasUnreads?: boolean;
  onPress?: () => void;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  return (
    <View alignItems="center" flex={1} onPress={onPress}>
      <Icon
        type={resolvedType}
        color={isActive ? '$primaryText' : '$activeBorder'}
      />
      <View justifyContent="center" alignItems="center">
        <Circle
          size="$s"
          backgroundColor={hasUnreads ? '$blue' : 'transparent'}
        />
      </View>
    </View>
  );
}
