import { BigInput, MessageInput, View } from '@tloncorp/ui';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
          send={async () => {}}
          channelId="channel-id"
          groupMembers={group.members ?? []}
          getDraft={async () => ({})}
          storeDraft={() => {}}
          clearDraft={() => {}}
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
          send={async () => {}}
          channelId="channel-id"
          groupMembers={group.members ?? []}
          getDraft={async () => ({})}
          storeDraft={() => {}}
          clearDraft={() => {}}
          placeholder="Write a note..."
        />
      </View>
    </FixtureWrapper>
  );
};

export default {
  chat: ChatMessageInputFixture,
  notebook: NotebookInputFixture,
};
