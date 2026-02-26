import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigInput, MessageInput, View } from '../ui';
import { LiveMarkdownMessageInput } from '../ui/components/MessageInput/LiveMarkdownMessageInput';
import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const ChatMessageInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <FixtureWrapper fillWidth>
      <View backgroundColor="$background">
        <MessageInput
          channelType="notebook"
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          sendPostFromDraft={async () => {}}
          channelId="channel-id"
          groupMembers={group.members ?? []}
          groupRoles={group.roles ?? []}
          getDraft={async () => ({})}
          storeDraft={async () => {}}
          clearDraft={async () => {}}
        />
      </View>
    </FixtureWrapper>
  );
};

const NotebookInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const { top } = useSafeAreaInsets();

  return (
    <FixtureWrapper fillWidth>
      <View paddingTop={top} backgroundColor="$background">
        <BigInput
          channelType="notebook"
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          sendPostFromDraft={async () => {}}
          channelId="channel-id"
          groupMembers={group.members ?? []}
          groupRoles={group.roles ?? []}
          getDraft={async () => ({})}
          storeDraft={async () => {}}
          clearDraft={async () => {}}
          placeholder="Write a note..."
        />
      </View>
    </FixtureWrapper>
  );
};

const LiveMarkdownInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <FixtureWrapper fillWidth>
      <View backgroundColor="$background">
        <LiveMarkdownMessageInput
          channelType="chat"
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          sendPostFromDraft={async () => {}}
          channelId="channel-id"
          groupMembers={group.members ?? []}
          groupRoles={group.roles ?? []}
          getDraft={async () => null}
          storeDraft={async () => {}}
          clearDraft={async () => {}}
          placeholder="Try **bold**, *italic*, `code`..."
        />
      </View>
    </FixtureWrapper>
  );
};

export default {
  chat: ChatMessageInputFixture,
  notebook: NotebookInputFixture,
  liveMarkdown: LiveMarkdownInputFixture,
};
