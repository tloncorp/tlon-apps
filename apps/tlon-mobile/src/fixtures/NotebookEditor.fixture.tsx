import type { JSONContent } from '@tloncorp/shared/dist/urbit';
import { NotebookEditor, View } from '@tloncorp/ui/';
import { useState } from 'react';

import { group, initialContacts } from './fakeData';

const NotebookEditorFixture = () => {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  const fakeSend = async (content: JSONContent) => {
    console.log('send', content);
  };

  return (
    <View height="100%" width="100%" backgroundColor="$background">
      <NotebookEditor
        shouldBlur={inputShouldBlur}
        setShouldBlur={setInputShouldBlur}
        group={group}
        contacts={initialContacts}
        send={fakeSend}
        channelId="channel-id"
      />
    </View>
  );
};

export default NotebookEditorFixture;
