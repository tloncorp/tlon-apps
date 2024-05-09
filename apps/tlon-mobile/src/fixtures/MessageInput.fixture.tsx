import { MessageInput, View } from '@tloncorp/ui';
import { useState } from 'react';

import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const MessageInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <FixtureWrapper fillWidth>
      <View backgroundColor="$background">
        <MessageInput
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          send={() => {}}
          channelId="channel-id"
          setImageAttachment={() => {}}
          canUpload={true}
          groupMembers={group.members ?? []}
          getDraft={async () => ({})}
          storeDraft={() => {}}
          clearDraft={() => {}}
        />
      </View>
    </FixtureWrapper>
  );
};

export default MessageInputFixture;
