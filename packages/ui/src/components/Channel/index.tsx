import {
  isChatChannel,
  useChannel as useChannelFromStore,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { Upload } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
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
import { Spinner, View, YStack } from '../../core';
import * as utils from '../../utils';
import { ChatMessage } from '../ChatMessage';
import { MessageInput } from '../MessageInput';
import { NotebookPost } from '../NotebookPost';
import { ChannelHeader } from './ChannelHeader';
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
  setImageAttachment,
  onScrollEndReached,
  onScrollStartReached,
  uploadedImage,
  imageAttachment,
  resetImageAttachment,
  isLoadingPosts,
  canUpload,
  onPressRef,
  usePost,
  useChannel,
}: {
  channel: db.Channel;
  currentUserId: string;
  selectedPost?: string;
  posts: db.Post[] | null;
  contacts: db.Contact[] | null;
  group: db.Group | null;
  calmSettings: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.Post) => void;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  messageSender: (content: Story, channelId: string) => void;
  imageAttachment?: string | null;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  resetImageAttachment: () => void;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  canUpload: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const title = utils.getChannelTitle(channel);
  const groups = useMemo(() => (group ? [group] : null), [group]);

  const chatChannel = isChatChannel(channel);
  const renderItem = chatChannel ? ChatMessage : NotebookPost;

  return (
    <CalmProvider initialCalm={calmSettings}>
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
                    <YStack flex={1}>
                      {imageAttachment ? (
                        <UploadedImagePreview
                          imageAttachment={imageAttachment}
                          resetImageAttachment={resetImageAttachment}
                        />
                      ) : !posts || !contacts ? (
                        <View
                          flex={1}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Spinner />
                        </View>
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
                          channelType={channel.type}
                          onPressReplies={goToPost}
                          onPressImage={goToImageViewer}
                          setInputShouldBlur={setInputShouldBlur}
                          onEndReached={onScrollEndReached}
                          onStartReached={onScrollStartReached}
                        />
                      )}
                      {chatChannel && (
                        <MessageInput
                          shouldBlur={inputShouldBlur}
                          setShouldBlur={setInputShouldBlur}
                          send={messageSender}
                          channelId={channel.id}
                          setImageAttachment={setImageAttachment}
                          uploadedImage={uploadedImage}
                          canUpload={canUpload}
                        />
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
