import * as db from '@tloncorp/shared/db';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { CreateGroupWidget } from './AddChats';
import { Button } from './Button';
import { TextButton } from './Buttons';
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
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title={'Create Group'}
        backAction={() =>
          screen === 'InviteUsers' ? goBack() : setScreen('InviteUsers')
        }
        showSessionStatus={false}
        rightControls={
          screen === 'InviteUsers' ? (
            <TextButton
              onPress={() => {
                setInvitees([]);
                setScreen('CreateGroup');
              }}
            >
              Skip
            </TextButton>
          ) : null
        }
      />
      {screen === 'InviteUsers' ? (
        <YStack flex={1} paddingBottom={bottom} paddingHorizontal="$2xl">
          <ContactBook
            multiSelect
            searchable
            searchPlaceholder="Filter by nickname, @p"
            onSelectedChange={setInvitees}
          />

          <Button
            marginTop="$m"
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
