import * as db from '@tloncorp/shared/dist/db';
import { KeyboardAvoidingView, Platform } from 'react-native';

import {
  CalmProvider,
  CalmState,
  ContactsProvider,
  GroupsProvider,
} from '../../contexts';
import { Spinner, View, YStack } from '../../core';
import * as utils from '../../utils';
import { ChannelHeader } from './ChannelHeader';
import ChatScroll from './ChatScroll';
import MessageInput from './MessageInput';

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
  // TODO: implement gallery and notebook
  type,
}: {
  channel: db.ChannelWithLastPostAndMembers;
  selectedPost?: string;
  posts: db.PostWithRelations[] | null;
  contacts: db.Contact[] | null;
  group: db.GroupWithRelations | null;
  calmSettings: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToSearch: () => void;
  type?: 'chat' | 'gallery' | 'notebook';
}) {
  const title = utils.getChannelTitle(channel);
  return (
    <CalmProvider initialCalm={calmSettings}>
      <GroupsProvider groups={group ? [group] : null}>
        <ContactsProvider contacts={contacts ?? null}>
          <YStack justifyContent="space-between" width="100%" height="100%">
            <ChannelHeader
              title={title}
              goBack={goBack}
              goToChannels={goToChannels}
              goToSearch={goToSearch}
              showPickerButton={!!group}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={70}
              style={{ flex: 1 }}
            >
              <YStack flex={1}>
                {!posts || !contacts ? (
                  <View flex={1} alignItems="center" justifyContent="center">
                    <Spinner />
                  </View>
                ) : (
                  <ChatScroll
                    unreadCount={channel.unreadCount ?? undefined}
                    selectedPost={selectedPost}
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
