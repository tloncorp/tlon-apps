import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChatListScreen from '@tloncorp/app/features/top/ChatListScreen';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider } from 'packages/ui/src';
import { useCallback, useState } from 'react';

import AddGroupSheet from '../components/AddGroupSheet';
import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function ChatListScreenController({
  navigation,
}: ChatListControllerProps) {
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [startDmOpen, setStartDmOpen] = useState(false);

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

  const goToChannel = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      setStartDmOpen(false);
      setAddGroupOpen(false);
      setTimeout(() => navigation.navigate('Channel', { channel }), 150);
    },
    [navigation]
  );

  const handleGroupCreated = useCallback(
    ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
    [goToChannel]
  );

  const { data: contacts } = store.useContacts();

  return (
    <>
      <ChatListScreen
        setStartDmOpen={setStartDmOpen}
        startDmOpen={startDmOpen}
        setAddGroupOpen={setAddGroupOpen}
        navigateToDm={(channel) => {
          navigation.push('Channel', { channel });
        }}
        navigateToGroupChannels={(group) => {
          navigation.navigate('GroupChannels', { group });
        }}
        navigateToSelectedPost={(channel, postId) => {
          navigation.navigate('Channel', { channel, selectedPostId: postId });
        }}
        navigateToHome={() => {
          navigation.navigate('ChatList');
        }}
        navigateToNotifications={() => {
          navigation.navigate('Activity');
        }}
        navigateToProfile={() => {
          navigation.navigate('Profile');
        }}
      />
      <AppDataContextProvider contacts={contacts ?? []}>
        <AddGroupSheet
          open={addGroupOpen}
          onOpenChange={handleAddGroupOpenChange}
          onCreatedGroup={handleGroupCreated}
        />
      </AppDataContextProvider>
    </>
  );
}
