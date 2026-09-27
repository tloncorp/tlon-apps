// tamagui-ignore
import { Theme } from 'tamagui';

import { DrawerChatButton } from '../navigation/TopLevelDrawerContent';
import { SizableText, View, XStack, YStack } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { brianContact, hostedBotContact } from './fakeData';

/**
 * The drawer's bot button in each thing it can show for the bot. The panel's
 * own fixture has no bot, so the button lives here. Any contact stands in for
 * the bot: the button reads whichever contact it is handed.
 *
 * Light and dark side by side, because the button's resting colour is the
 * panel's ink and so is a different colour in each.
 */
const specimens = [
  { label: 'avatar', botId: brianContact.id, hasUnread: false },
  {
    label: 'no avatar: its sigil',
    botId: hostedBotContact.id,
    hasUnread: false,
  },
  {
    label: 'contact not synced yet: the glyph',
    botId: '~pinser-botter-zod',
    hasUnread: false,
  },
  { label: 'unread', botId: brianContact.id, hasUnread: true },
  {
    label: 'unread, contact not synced yet',
    botId: '~pinser-botter-zod',
    hasUnread: true,
  },
];

function Specimens() {
  return (
    <YStack gap="$xl" padding="$xl" backgroundColor="$background" flex={1}>
      {specimens.map(({ label, botId, hasUnread }) => (
        <View key={label} gap="$s" alignItems="flex-start">
          <SizableText size="$s" color="$secondaryText">
            {label}
          </SizableText>
          <DrawerChatButton
            botId={botId}
            hasUnread={hasUnread}
            selected={false}
            onPress={() => {}}
          />
        </View>
      ))}
    </YStack>
  );
}

export default (
  <FixtureWrapper fillWidth>
    <XStack>
      <Theme name="light">
        <Specimens />
      </Theme>
      <Theme name="dark">
        <Specimens />
      </Theme>
    </XStack>
  </FixtureWrapper>
);
