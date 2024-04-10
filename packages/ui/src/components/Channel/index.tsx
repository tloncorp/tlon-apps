import { JSONContent } from '@tiptap/core';
import * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';
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
import { MessageInput } from '../MessageInput';
import { ChannelHeader } from './ChannelHeader';
import ChatScroll from './ChatScroll';

export function Channel({
  channel,
  posts,
  selectedPost,
  contacts,
  group,
  calmSettings,
  goBack,
  goToChannels,
  goToSearch,
  messageSender,
  // TODO: implement gallery and notebook
  type,
}: {
  channel: db.Channel;
  posts: db.PostWithRelations[] | null;
  selectedPost?: string;
  contacts: db.Contact[];
  group: db.GroupWithRelations;
  calmSettings: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToSearch: () => void;
  messageSender: (content: JSONContent, channelId: string) => void;
  type?: 'chat' | 'gallery' | 'notebook';
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
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
                    selectedPost={selectedPost}
                    firstUnread={channel.firstUnreadPostId ?? undefined}
                    posts={posts}
                    setInputShouldBlur={setInputShouldBlur}
                  />
                )}
                <MessageInput
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  contacts={contacts}
                  group={group}
                  send={messageSender}
                  channelId={channel.id}
                />
              </YStack>
            </KeyboardAvoidingView>
          </YStack>
        </ContactsProvider>
      </GroupsProvider>
    </CalmProvider>
  );
}
