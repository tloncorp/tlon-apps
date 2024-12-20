import { ScrollView, View, XStack } from 'tamagui';

import { Icon, IconType } from './Icon';
import { Text } from './TextV2';

export function ProfileUserInfo() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <UserInfoBadge title="Since 2022" icon="Clock" />
      <UserInfoBadge title="Superconnected" icon="Bang" />
      <UserInfoBadge title="3 Factory Resets" icon="Dragger" />
      <UserInfoBadge title="0xd8dA...6045" icon="Discover" />
    </ScrollView>
  );
}

function UserInfoBadge({ title, icon }: { title: string; icon: IconType }) {
  return (
    <XStack
      backgroundColor="$gray100"
      paddingVertical="$m"
      paddingHorizontal="$l"
      borderRadius="$l"
      gap="$s"
      alignItems="center"
      marginRight="$m"
    >
      <Icon type={icon} customSize={[16, 16]} />
      <Text size="$label/m">{title}</Text>
    </XStack>
  );
}
