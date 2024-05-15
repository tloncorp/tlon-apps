import type * as api from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { CalmProvider, CalmState, ContactsProvider } from '../contexts';
import { YStack } from '../core';
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
}: {
  currentUserId: string;
  calmSettings?: CalmState;
  contacts: db.Contact[] | null;
  channel: db.Channel | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  uploadInfo: api.UploadInfo;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <ContactsProvider contacts={contacts}>
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
              channel && (
                <Scroller
                  setInputShouldBlur={setInputShouldBlur}
                  inverted
                  renderItem={ChatMessage}
                  channelType={channel.type}
                  channelId={channel.id}
                  currentUserId={currentUserId}
                  posts={posts}
                  showReplies={false}
                  onPressImage={handleGoToImage}
                />
              )
            )}
            {channel && (
              <MessageInput
                shouldBlur={inputShouldBlur}
                setShouldBlur={setInputShouldBlur}
                send={sendReply}
                channelId={channel.id}
                uploadInfo={uploadInfo}
                groupMembers={groupMembers}
                storeDraft={storeDraft}
                clearDraft={clearDraft}
                getDraft={getDraft}
              />
            )}
          </KeyboardAvoidingView>
        </YStack>
      </ContactsProvider>
    </CalmProvider>
  );
}
