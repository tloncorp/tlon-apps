import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { CreateGroupWidget } from './AddChats';
import { Button } from './Button';
import { ContactBook } from './ContactBook';
import { ScreenHeader } from './ScreenHeader';

type screen = 'InviteUsers' | 'CreateGroup';

export function CreateGroupView({
  goBack,
  navigateToChannel,
}: {
  goBack: () => void;
  navigateToChannel: (channel: db.Channel) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [screen, setScreen] = useState<screen>('InviteUsers');
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleCreatedGroup = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      navigateToChannel(channel);
    },
    [navigateToChannel]
  );

  return (
    <View flex={1}>
      <ScreenHeader
        title={'Select members'}
        backAction={() =>
          screen === 'InviteUsers' ? goBack() : setScreen('InviteUsers')
        }
        showSessionStatus={false}
        rightControls={
          screen === 'InviteUsers' ? (
            <ScreenHeader.TextButton
              onPress={() => {
                setInvitees([]);
                setScreen('CreateGroup');
              }}
            >
              Skip
            </ScreenHeader.TextButton>
          ) : null
        }
      />
      {screen === 'InviteUsers' ? (
        <YStack flex={1} paddingBottom={bottom}>
          <ContactBook
            multiSelect
            searchable
            searchPlaceholder="Filter by nickname, @p"
            onSelectedChange={setInvitees}
          />
          <View padding="$xl">
            <Button
              hero
              onPress={() => {
                setScreen('CreateGroup');
              }}
              disabled={invitees.length === 0}
            >
              <Button.Text>
                {invitees.length === 0
                  ? 'Invite'
                  : `Invite ${invitees.length} and continue`}
              </Button.Text>
            </Button>
          </View>
        </YStack>
      ) : (
        <CreateGroupWidget
          invitees={invitees}
          onCreatedGroup={handleCreatedGroup}
        />
      )}
    </View>
  );
}
