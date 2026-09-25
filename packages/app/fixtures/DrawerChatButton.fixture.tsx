// tamagui-ignore
import { DrawerChatButton } from '../navigation/TopLevelDrawerContent';
import { SizableText, View, YStack } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { brianContact, hostedBotContact } from './fakeData';

/**
 * The drawer's bot button in each thing it can show for the bot. The panel's
 * own fixture has no bot, so the button lives here. Any contact stands in for
 * the bot: the button reads whichever contact it is handed.
 */
const specimens = [
  { label: 'avatar', botId: brianContact.id },
  { label: 'no avatar: its sigil', botId: hostedBotContact.id },
  { label: 'contact not synced yet: the glyph', botId: '~pinser-botter-zod' },
];

export default (
  <FixtureWrapper fillWidth>
    <YStack gap="$xl" padding="$xl">
      {specimens.map(({ label, botId }) => (
        <View key={label} gap="$s" alignItems="flex-start">
          <SizableText size="$s" color="$secondaryText">
            {label}
          </SizableText>
          <DrawerChatButton
            botId={botId}
            hasUnread={false}
            selected={false}
            onPress={() => {}}
          />
        </View>
      ))}
    </YStack>
  </FixtureWrapper>
);
