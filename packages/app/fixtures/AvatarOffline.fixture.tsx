// tamagui-ignore
import { ContactAvatar, SizableText, View, XStack, YStack } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { claimBotContact, offlineBotContact } from './fakeData';

const sizes = ['$xl', '$2xl', '$3xl', '$4xl', '$5xl'] as const;

export default (
  <FixtureWrapper fillWidth>
    <YStack gap="$l" padding="$l">
      <View>
        <SizableText size="$s" color="$secondaryText">
          online bot
        </SizableText>
        <XStack gap="$l" alignItems="center">
          {sizes.map((s) => (
            <ContactAvatar
              key={s}
              size={s}
              contactId={claimBotContact.id}
              contactOverride={claimBotContact}
            />
          ))}
        </XStack>
      </View>
      <View>
        <SizableText size="$s" color="$secondaryText">
          offline bot (dimmed, corner dot except $xl)
        </SizableText>
        <XStack gap="$l" alignItems="center">
          {sizes.map((s) => (
            <ContactAvatar
              key={s}
              size={s}
              contactId={offlineBotContact.id}
              contactOverride={offlineBotContact}
            />
          ))}
        </XStack>
      </View>
    </YStack>
  </FixtureWrapper>
);
