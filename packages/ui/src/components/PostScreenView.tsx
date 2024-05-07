import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { CalmProvider, CalmState } from '../contexts';
import { YStack } from '../core';
import { ChannelHeader } from './Channel/ChannelHeader';
import Scroller from './Channel/Scroller';
import { ChatMessage } from './ChatMessage';
import { MessageInput } from './MessageInput';

export function PostScreenView({
  currentUserId,
  calmSettings,
  channel,
  posts,
  sendReply,
  goBack,
}: {
  currentUserId: string;
  calmSettings?: CalmState;
  channel: db.Channel | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => void;
  goBack?: () => void;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  return (
    <CalmProvider calmSettings={calmSettings}>
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
          {posts && channel && (
            <Scroller
              setInputShouldBlur={setInputShouldBlur}
              inverted
              renderItem={ChatMessage}
              channelType={channel.type}
              currentUserId={currentUserId}
              posts={posts}
              showReplies={false}
            />
          )}
          {channel && (
            <MessageInput
              shouldBlur={inputShouldBlur}
              setShouldBlur={setInputShouldBlur}
              send={sendReply}
              channelId={channel.id}
              setImageAttachment={() => {}}
            />
          )}
        </KeyboardAvoidingView>
      </YStack>
    </CalmProvider>
  );
}
