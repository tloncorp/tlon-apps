import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import {
  AppDataContextProvider,
  useContacts,
  useCurrentUserId,
} from '../contexts';
import { CreateGroupWidget } from './AddChats';
import { Button } from './Button';
import { TextButton } from './Buttons';
import { ContactBook } from './ContactBook';
import { GenericHeader } from './GenericHeader';

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
  const contacts = useContacts();
  const currentUserId = useCurrentUserId();

  const handleCreatedGroup = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      navigateToChannel(channel);
    },
    [navigateToChannel]
  );

  return (
    <View flex={1}>
      <GenericHeader
        title={'Create Group'}
        goBack={() =>
          screen === 'InviteUsers' ? goBack() : setScreen('InviteUsers')
        }
        showSessionStatus={false}
        rightContent={
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
      <View flex={1} padding="$xl">
        {screen === 'InviteUsers' ? (
          <AppDataContextProvider
            contacts={contacts ?? null}
            currentUserId={currentUserId}
          >
            <YStack flex={1} gap="$xl" paddingBottom={bottom}>
              <Text textAlign="center" fontSize="$l" fontWeight="$xl">
                Select members
              </Text>
              <ContactBook
                multiSelect
                searchable
                searchPlaceholder="Filter by nickname, @p"
                onSelectedChange={setInvitees}
              />
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
            </YStack>
          </AppDataContextProvider>
        ) : (
          <CreateGroupWidget
            invitees={invitees}
            onCreatedGroup={handleCreatedGroup}
          />
        )}
      </View>
    </View>
  );
}
