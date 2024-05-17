import {
  isChatChannel,
  useChannel as useChannelFromStore,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { UploadInfo } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import {
  CalmProvider,
  CalmState,
  ContactsProvider,
  GroupsProvider,
  NavigationProvider,
} from '../../contexts';
import { ReferencesProvider } from '../../contexts/references';
import { RequestsProvider } from '../../contexts/requests';
import { Spinner, Text, View, YStack } from '../../core';
import * as utils from '../../utils';
import { ChatMessage } from '../ChatMessage';
import { MessageInput } from '../MessageInput';
import { NotebookPost } from '../NotebookPost';
import { ChannelHeader } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { EmptyChannelNotice } from './EmptyChannelNotice';
import Scroller from './Scroller';
import UploadedImagePreview from './UploadedImagePreview';

//TODO implement usePost and useChannel
const useGroup = () => {};
const useApp = () => {};

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
  goToImageViewer,
  goToPost,
  messageSender,
  onScrollEndReached,
  onScrollStartReached,
  uploadInfo,
  isLoadingPosts,
  onPressRef,
  usePost,
  useChannel,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  negotiationMatch,
}: {
  channel: db.Channel;
  currentUserId: string;
  selectedPost?: string;
  posts: db.Post[] | null;
  contacts: db.Contact[] | null;
  group: db.Group | null;
  calmSettings?: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.Post) => void;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  messageSender: (content: Story, channelId: string) => void;
  uploadInfo: UploadInfo;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => void;
  negotiationMatch: boolean;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const title = utils.getChannelTitle(channel);
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const canWrite = utils.useCanWrite(channel, currentUserId);

  const chatChannel = isChatChannel(channel);
  const renderItem = chatChannel ? ChatMessage : NotebookPost;

  return (
    <CalmProvider calmSettings={calmSettings}>
      <GroupsProvider groups={groups}>
        <ContactsProvider contacts={contacts ?? null}>
          <RequestsProvider
            usePost={usePost}
            useChannel={useChannel}
            useGroup={useGroup}
            useApp={useApp}
          >
            <NavigationProvider onPressRef={onPressRef}>
              <ReferencesProvider>
                <YStack
                  justifyContent="space-between"
                  width="100%"
                  height="100%"
                >
                  <ChannelHeader
                    title={title}
                    goBack={goBack}
                    goToChannels={goToChannels}
                    goToSearch={goToSearch}
                    showPickerButton={!!group}
                    showSpinner={isLoadingPosts}
                  />
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flex: 1 }}
                  >
                    <YStack alignItems="center" flex={1}>
                      {uploadInfo.imageAttachment ? (
                        <UploadedImagePreview
                          imageAttachment={uploadInfo.imageAttachment}
                          resetImageAttachment={uploadInfo.resetImageAttachment}
                        />
                      ) : !posts || !contacts ? (
                        <View
                          flex={1}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Spinner />
                        </View>
                      ) : posts.length === 0 && group !== null ? (
                        <EmptyChannelNotice
                          channel={channel}
                          userId={currentUserId}
                        />
                      ) : (
                        <Scroller
                          inverted={chatChannel ? true : false}
                          renderItem={renderItem}
                          currentUserId={currentUserId}
                          unreadCount={channel.unread?.count ?? undefined}
                          selectedPost={selectedPost}
                          firstUnread={
                            channel.unread?.firstUnreadPostId ?? undefined
                          }
                          posts={posts}
                          editingPost={editingPost}
                          setEditingPost={setEditingPost}
                          editPost={editPost}
                          channelType={channel.type}
                          channelId={channel.id}
                          onPressReplies={goToPost}
                          onPressImage={goToImageViewer}
                          setInputShouldBlur={setInputShouldBlur}
                          onEndReached={onScrollEndReached}
                          onStartReached={onScrollStartReached}
                        />
                      )}
                      {negotiationMatch &&
                        !editingPost &&
                        !channel.isDmInvite &&
                        chatChannel &&
                        canWrite && (
                          <MessageInput
                            shouldBlur={inputShouldBlur}
                            setShouldBlur={setInputShouldBlur}
                            send={messageSender}
                            channelId={channel.id}
                            setImageAttachment={uploadInfo.setImageAttachment}
                            uploadedImage={uploadInfo.uploadedImage}
                            canUpload={uploadInfo.canUpload}
                            groupMembers={group?.members ?? []}
                            storeDraft={storeDraft}
                            clearDraft={clearDraft}
                            getDraft={getDraft}
                          />
                        )}
                      {channel.isDmInvite && (
                        <DmInviteOptions
                          channel={channel}
                          goBack={goBack}
                          currentUserId={currentUserId}
                        />
                      )}
                      {!negotiationMatch && chatChannel && canWrite && (
                        <View
                          width="90%"
                          alignItems="center"
                          justifyContent="center"
                          backgroundColor="$secondaryBackground"
                          borderRadius="$xl"
                          padding="$l"
                        >
                          <Text>
                            Your ship&apos;s version of the Tlon app
                            doesn&apos;t match the channel host.
                          </Text>
                        </View>
                      )}
                    </YStack>
                  </KeyboardAvoidingView>
                </YStack>
              </ReferencesProvider>
            </NavigationProvider>
          </RequestsProvider>
        </ContactsProvider>
      </GroupsProvider>
    </CalmProvider>
  );
}
