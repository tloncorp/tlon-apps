import type { ClientTypes } from '@tloncorp/shared';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { YStack } from 'tamagui';

import { useContacts } from '../../contexts';
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
  channel: ClientTypes.Channel;
  posts: ClientTypes.Post[];
  goBack: () => void;
  goToChannels: () => void;
  goToSearch: () => void;
  type?: 'chat' | 'gallery' | 'notebook';
}) {
  const generateTitleFromMembers = (members: ClientTypes.GroupMember[]) => {
    const contacts = useContacts();
    return members
      .map((m) => contacts[m.id].nickname || contacts[m.id].id)
      .join(', ');
  };

  const title = channel.title
    ? channel.title
    : channel.group && channel.group.members
      ? generateTitleFromMembers(channel.group.members)
      : 'Channel';

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
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <YStack>
            <ChatScroll posts={posts} />
            <MessageInput />
          </YStack>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </YStack>
  );
}
