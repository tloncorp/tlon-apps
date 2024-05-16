import type * as api from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { CalmProvider, CalmState, ContactsProvider } from '../contexts';
import { ReferencesProvider } from '../contexts/references';
import { Text, View, YStack } from '../core';
import * as utils from '../utils';
import { ChannelHeader } from './Channel/ChannelHeader';
import Scroller from './Channel/Scroller';
import UploadedImagePreview from './Channel/UploadedImagePreview';
import { ChatMessage } from './ChatMessage';
import { MessageInput } from './MessageInput';

export function PostScreenView({
  currentUserId,
  contacts,
  channel,
  posts,
  sendReply,
  goBack,
  groupMembers,
  calmSettings,
  uploadInfo,
  handleGoToImage,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  negotiationMatch,
}: {
  currentUserId: string;
  calmSettings?: CalmState;
  contacts: db.Contact[] | null;
  channel: db.Channel;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  uploadInfo: api.UploadInfo;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => void;
  negotiationMatch: boolean;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const canWrite = utils.useCanWrite(channel, currentUserId);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <ContactsProvider contacts={contacts}>
        <ReferencesProvider>
          <YStack flex={1} backgroundColor={'$background'}>
            <ChannelHeader
              title={'Thread: ' + (channel?.title ?? null)}
              goBack={goBack}
              showPickerButton={false}
              showSearchButton={false}
            />
            <KeyboardAvoidingView
              //TODO: Standardize this component, account for tab bar in a better way
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={70}
              style={{ flex: 1 }}
            >
              {uploadInfo.imageAttachment ? (
                <UploadedImagePreview
                  imageAttachment={uploadInfo.imageAttachment}
                  resetImageAttachment={uploadInfo.resetImageAttachment}
                />
              ) : (
                posts &&
                // Delay rendering until replies have been loaded.
                posts.length > 1 &&
                channel && (
                  <Scroller
                    setInputShouldBlur={setInputShouldBlur}
                    inverted
                    renderItem={ChatMessage}
                    channelType={channel.type}
                    channelId={channel.id}
                    currentUserId={currentUserId}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPost={editPost}
                    posts={posts}
                    showReplies={false}
                    onPressImage={handleGoToImage}
                  />
                )
              )}
              {negotiationMatch && !editingPost && channel && canWrite && (
                <MessageInput
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  send={sendReply}
                  channelId={channel.id}
                  setImageAttachment={uploadInfo.setImageAttachment}
                  uploadedImage={uploadInfo.uploadedImage}
                  canUpload={uploadInfo.canUpload}
                  groupMembers={groupMembers}
                  storeDraft={storeDraft}
                  clearDraft={clearDraft}
                  getDraft={getDraft}
                />
              )}
              {!negotiationMatch && channel && canWrite && (
                <View
                  width="90%"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$secondaryBackground"
                  borderRadius="$xl"
                  padding="$l"
                >
                  <Text>
                    Your ship&apos;s version of the Tlon app doesn&apos;t match
                    the channel host.
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          </YStack>
        </ReferencesProvider>
      </ContactsProvider>
    </CalmProvider>
  );
}
