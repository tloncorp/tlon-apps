import { Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import { InviteFriendsToTlonButton } from '../ui/components/InviteFriendsToTlonButton';
import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

function InviteFriendsToTlonButtonFixture() {
  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$2xl">
        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            With Group
          </Text>
          <Text size="$label/s" color="$tertiaryText">
            Shows invite button for a group (link generation depends on backend)
          </Text>
          <InviteFriendsToTlonButton group={group} />
        </YStack>

        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            Without Group
          </Text>
          <Text size="$label/s" color="$tertiaryText">
            Shows loading/error state when no group is provided
          </Text>
          <InviteFriendsToTlonButton group={undefined} />
        </YStack>
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Invite Friends Button': <InviteFriendsToTlonButtonFixture />,
};
