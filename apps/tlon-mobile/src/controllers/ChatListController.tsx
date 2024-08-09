import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChatListScreen from '@tloncorp/app/features/top/ChatListScreen';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';

import AddGroupSheet from '../components/AddGroupSheet';
import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function ChatListController({ navigation }: ChatListControllerProps) {
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
        navigateToGroupMeta={(groupId) => {
          navigation.navigate('GroupSettings', {
            // @ts-expect-error - navigation type mismatch
            screen: 'GroupMeta',
            params: { groupId },
          });
        }}
        navigateToGroupMembers={(groupId) => {
          navigation.navigate('GroupSettings', {
            // @ts-expect-error - navigation type mismatch
            screen: 'GroupMembers',
            params: { groupId },
          });
        }}
        navigateToManageChannels={(groupId) => {
          navigation.navigate('GroupSettings', {
            // @ts-expect-error - navigation type mismatch
            screen: 'ManageChannels',
            params: { groupId },
          });
        }}
        navigateToInvitesAndPrivacy={(groupId) => {
          navigation.navigate('GroupSettings', {
            // @ts-expect-error - navigation type mismatch
            screen: 'InvitesAndPrivacy',
            params: { groupId },
          });
        }}
        navigateToRoles={(groupId) => {
          navigation.navigate('GroupSettings', {
            // @ts-expect-error - navigation type mismatch
            screen: 'Roles',
            params: { groupId },
          });
        }}
        navigateToErrorReporter={() => {
          navigation.navigate('WompWomp');
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
      <AddGroupSheet
        open={addGroupOpen}
        onOpenChange={handleAddGroupOpenChange}
        onCreatedGroup={handleGroupCreated}
      />
    </>
  );
}
