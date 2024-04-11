import { MessageInput, View } from '@tloncorp/ui/';
import { useState } from 'react';

const MessageInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <View backgroundColor="$background">
      <MessageInput
        shouldBlur={inputShouldBlur}
        setShouldBlur={setInputShouldBlur}
        send={() => {}}
        channelId="channel-id"
      />
    </View>
  );
};

export default MessageInputFixture;
