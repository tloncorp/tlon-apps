import { MessageInput, View } from '@tloncorp/ui/';
import { useState } from 'react';

import { group, initialContacts } from './fakeData';

const MessageInputFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  return (
    <View backgroundColor="$background">
      <MessageInput
        shouldBlur={inputShouldBlur}
        setShouldBlur={setInputShouldBlur}
        group={group}
        contacts={initialContacts}
        send={() => {}}
        channelId="channel-id"
      />
    </View>
  );
};

export default MessageInputFixture;
