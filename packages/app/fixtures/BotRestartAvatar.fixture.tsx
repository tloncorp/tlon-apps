import { Text, View, XStack, YStack } from 'tamagui';

import { BotRestartAvatar } from '../ui/components/Channel/BotRestartAvatar';
import { FixtureWrapper } from './FixtureWrapper';

function Avatar({ size }: { size: number }) {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size / 4}
      backgroundColor="$secondaryBackground"
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize={size / 2}>🤖</Text>
    </View>
  );
}

export default {
  States: (
    <FixtureWrapper>
      <XStack gap="$2xl" padding="$2xl" alignItems="center">
        <YStack gap="$s" alignItems="center">
          <BotRestartAvatar restarting={false}>
            <Avatar size={64} />
          </BotRestartAvatar>
          <Text>Running</Text>
        </YStack>
        <YStack gap="$s" alignItems="center">
          <BotRestartAvatar restarting>
            <Avatar size={64} />
          </BotRestartAvatar>
          <Text>Restarting</Text>
        </YStack>
        <YStack gap="$s" alignItems="center">
          <BotRestartAvatar restarting>
            <Avatar size={32} />
          </BotRestartAvatar>
          <Text>Header</Text>
        </YStack>
      </XStack>
    </FixtureWrapper>
  ),
};
