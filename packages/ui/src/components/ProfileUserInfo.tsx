import { useMemo } from 'react';
import { ScrollView, View, XStack } from 'tamagui';

import { Icon, IconType } from './Icon';
import { Text } from './TextV2';

export function ProfileUserInfo() {
  const UserInfo = useMemo(() => generateRandomUserInfo(), []);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {UserInfo.map((info) => {
        return (
          <UserInfoBadge
            title={info.title}
            icon={info.icon as IconType}
            key={info.title}
          />
        );
      })}
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

export function generateRandomUserInfo() {
  // Generate random year between 2017-2024
  const randomYear = Math.floor(Math.random() * (2024 - 2017 + 1)) + 2017;

  // Generate random ETH address
  const generateEthAddress = () => {
    const fullAddress =
      '0x' +
      Array(40)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');

    // Show first 4 and last 4 characters
    return `${fullAddress.slice(0, 6)}...${fullAddress.slice(-4)}`;
  };

  // Generate random number of factory resets (0-12)
  const factoryResets = Math.floor(Math.random() * 13);

  return [
    {
      title: `Since ${randomYear}`,
      icon: 'Clock',
    },
    {
      title: 'Superconnected',
      icon: 'Bang',
    },
    {
      title: `${factoryResets} Factory Reset${factoryResets !== 1 ? 's' : ''}`,
      icon: 'Dragger',
    },
    {
      title: generateEthAddress(),
      icon: 'Discover',
    },
  ];
}
