import { JSONContent } from '@tiptap/core';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';
import { Upload } from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import {
  CalmProvider,
  CalmState,
  ContactsProvider,
  GroupsProvider,
} from '../../contexts';
import { Spinner, View, YStack } from '../../core';
import * as utils from '../../utils';
import { MessageInput } from '../MessageInput';
import { ChannelHeader } from './ChannelHeader';
import ChatScroll from './ChatScroll';

export function Channel({
  channel,
  currentUserId,
  posts,
  selectedPost,
  contacts,
  group,
  calmSettings,
  goBack,
  goToChannels,
  goToSearch,
  goToPost,
  messageSender,
  imageAttachment,
  setImageAttachment,
  onScrollEndReached,
  onScrollStartReached,
  uploadedImage,
  resetImageAttachment,
  // TODO: implement gallery and notebook
  type,
  isLoadingPosts,
}: {
  channel: db.ChannelWithLastPostAndMembers;
  currentUserId: string;
  selectedPost?: string;
  posts: db.PostWithRelations[] | null;
  contacts: db.Contact[] | null;
  group: db.GroupWithRelations | null;
  calmSettings: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.PostInsert) => void;
  goToSearch: () => void;
  messageSender: (
    content: JSONContent,
    channelId: string,
    blocks: ub.Block[]
  ) => void;
  imageAttachment: string | null;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  resetImageAttachment: () => void;
  type?: 'chat' | 'gallery' | 'notebook';
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
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
              showSpinner={isLoadingPosts}
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
                    currentUserId={currentUserId}
                    unreadCount={channel.unreadCount ?? undefined}
                    selectedPost={selectedPost}
                    firstUnread={channel.firstUnreadPostId ?? undefined}
                    posts={posts}
                    channelType={channel.type}
                    onPressReplies={goToPost}
                    setInputShouldBlur={setInputShouldBlur}
                    onEndReached={onScrollEndReached}
                    onStartReached={onScrollStartReached}
                  />
                )}
                <MessageInput
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  send={messageSender}
                  channelId={channel.id}
                  setImageAttachment={setImageAttachment}
                  imageAttachment={imageAttachment}
                  uploadedImage={uploadedImage}
                  resetImageAttachment={resetImageAttachment}
                />
              </YStack>
            </KeyboardAvoidingView>
          </YStack>
        </ContactsProvider>
      </GroupsProvider>
    </CalmProvider>
  );
}
