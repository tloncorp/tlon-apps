import * as client from '@tloncorp/shared/dist/client';
import * as db from '@tloncorp/shared/dist/db';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Spinner } from 'tamagui';

import {
  CalmProvider,
  CalmState,
  ContactsProvider,
  GroupsProvider,
} from '../../contexts';
import { YStack } from '../../core';
import useChannelTitle from '../../hooks/useChannelTitle';
import { ChannelHeader } from './ChannelHeader';
import ChatScroll from './ChatScroll';
import MessageInput from './MessageInput';

export function Channel({
  channel,
  posts,
  contacts,
  group,
  calmSettings,
  goBack,
  goToChannels,
  goToSearch,
  // TODO: implement gallery and notebook
  type,
}: {
  channel: db.Channel;
  posts: db.PostWithRelations[] | null;
  contacts: db.Contact[];
  group: db.GroupWithRelations;
  calmSettings: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToSearch: () => void;
  type?: 'chat' | 'gallery' | 'notebook';
}) {
  const title = useChannelTitle(channel);
  return (
    <CalmProvider initialCalm={calmSettings}>
      <GroupsProvider initialGroups={[group]}>
        <ContactsProvider initialContacts={contacts}>
          <YStack justifyContent="space-between" width="100%" height="100%">
            <ChannelHeader
              title={title}
              goBack={goBack}
              goToChannels={goToChannels}
              goToSearch={goToSearch}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={70}
              style={{ flex: 1 }}
            >
              <YStack flex={1}>
                {posts === null ? (
                  <Spinner />
                ) : (
                  <ChatScroll
                    unreadCount={channel.unreadCount ?? undefined}
                    firstUnread={channel.firstUnreadPostId ?? undefined}
                    posts={posts}
                  />
                )}
                <MessageInput />
              </YStack>
            </KeyboardAvoidingView>
          </YStack>
        </ContactsProvider>
      </GroupsProvider>
    </CalmProvider>
  );
}
