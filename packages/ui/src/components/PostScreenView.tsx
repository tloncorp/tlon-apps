import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { YStack } from '../core';
import { ChannelHeader } from './Channel/ChannelHeader';
import ChatScroll from './Channel/ChatScroll';
import { MessageInput } from './MessageInput';

export function PostScreenView({
  currentUserId,
  channel,
  posts,
  sendReply,
  goBack,
}: {
  currentUserId: string;
  channel: db.Channel | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => void;
  goBack?: () => void;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  return (
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
          <ChatScroll
            setInputShouldBlur={setInputShouldBlur}
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
  );
}
