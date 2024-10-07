import { ActionSheet, Icon, Image, View, XStack, YStack } from '@tloncorp/ui';

import { Text } from '../TextV2';

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
        <YStack gap="$3.5xl" paddingHorizontal="$2xl">
          <View borderRadius="$2xl" overflow="hidden">
            <Image
              style={{ width: '100%', height: 188 }}
              resizeMode={'cover'}
              source={require('../../assets/raster/welcome_blocks.jpg')}
            />
          </View>

          <YStack gap="$l">
            <Text fontSize={32} fontWeight={'400'} size="$title/l">
              Welcome to Tlon
            </Text>
            <Text size="$body" color="$tertiaryText">
              A messenger you can actually trust.
            </Text>
          </YStack>

          <XStack gap="$l">
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
              <Text fontWeight="$xl">
                Tlon operates on a peer-to-peer network.
              </Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                Practically, this means your free account is a cloud computer.
                You can run it yourself, or we can run it for you.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l">
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
              <Text fontWeight="$xl">Hassle-free messaging you can trust.</Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                We&rsquo;ll make sure your computer is online and up-to-date.
                Interested in self-hosting? You can always change your mind.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l">
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
              <Text fontWeight="$xl">Sign up with your email address.</Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                We&rsquo;ll ask you a few questions to get you set up.
              </Text>
            </YStack>
          </XStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
