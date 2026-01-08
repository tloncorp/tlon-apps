import { Button, Text } from '@tloncorp/ui';

import { ActionSheet, Icon, Image, View, XStack, YStack } from '../..';

export function OnboardingBenefitsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Content>
        <YStack gap="$2xl" paddingHorizontal="$2xl">
          <View borderRadius="$xl" overflow="hidden">
            <Image
              style={{ width: '100%', height: 188 }}
              resizeMode={'cover'}
              source={require('../../assets/raster/welcome_blocks.jpg')}
            />
          </View>

          <YStack gap="$l">
            <Text fontSize={24} fontWeight={'600'}>
              Welcome to Tlon Messenger
            </Text>
            <Text size="$body" color="$tertiaryText">
              A messenger you can actually trust.
            </Text>
          </YStack>

          <XStack gap="$l" alignItems="center">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="Bang" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontSize={'$l'} fontWeight="$xl">
                Tlon is a peer-to-peer network.
              </Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                Each account is a personal cloud computer—run it yourself or let
                us host it. Either way, it's truly yours.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l" alignItems="center">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="ChannelTalk" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontSize={'$l'} fontWeight="$xl">
                Hassle-free messaging you can trust.
              </Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                We handle uptime, security, and updates—your node is always up
                to date.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l" alignItems="center">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="Send" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontSize={'$l'} fontWeight="$xl">
                Sign via email or phone.
              </Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                Claim your node in seconds and start connecting right away.
              </Text>
            </YStack>
          </XStack>
          <Button
            onPress={() => onOpenChange(false)}
            label="Continue"
            centered
          />
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
