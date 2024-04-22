import type { Upload } from '@tloncorp/shared/dist/urbit';
import { MessageInput, View } from '@tloncorp/ui/';
import { useState } from 'react';

import { FixtureWrapper } from './FixtureWrapper';

const uploadedImage: Upload = {
  key: 'key',
  file: {
    blob: new Blob(),
    name: 'name',
    type: 'type',
  },
  url: 'https://togten.com:9001/finned-palmer/~dotnet-botnet-finned-palmer/2024.4.22..11.6.47..3604.1893.74bc.6a7e-270413EC-3A1C-4478-AA24-B1F867FEBD41.jpg',
  status: 'success',
  size: [100, 100],
};

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
          uploadedImage={uploadedImage}
        />
      </View>
    </FixtureWrapper>
  );
};

export default MessageInputFixture;
