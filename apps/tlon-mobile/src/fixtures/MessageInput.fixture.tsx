import { MessageInput, View } from '@tloncorp/ui/';
import { useState } from 'react';

import { FixtureWrapper } from './FixtureWrapper';

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
          imageAttachment={null}
          setImageAttachment={() => {}}
          resetImageAttachment={() => {}}
        />
      </View>
    </FixtureWrapper>
  );
};

export default MessageInputFixture;
