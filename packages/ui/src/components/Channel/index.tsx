import * as client from '@tloncorp/shared/dist/client';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { YStack } from '../../core';
import useChannelTitle from '../../hooks/useChannelTitle';
import { ChannelHeader } from './ChannelHeader';
import ChatScroll from './ChatScroll';
import MessageInput from './MessageInput';

export function Channel({
  channel,
  posts,
  goBack,
  goToChannels,
  goToSearch,
  // TODO: implement gallery and notebook
  type,
}: {
  channel: client.Channel;
  posts: client.Post[];
  goBack: () => void;
  goToChannels: () => void;
  goToSearch: () => void;
  type?: 'chat' | 'gallery' | 'notebook';
}) {
  const title = useChannelTitle(channel);
  return (
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
          <ChatScroll posts={posts} />
          <MessageInput />
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  );
}
