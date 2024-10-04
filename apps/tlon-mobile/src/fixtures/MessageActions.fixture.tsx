import * as db from '@tloncorp/shared/dist/db';
import { ChatMessageActions, Modal, ZStack } from '@tloncorp/ui';
import { ChannelAction } from 'packages/shared/dist';
import { createRef, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ChannelFixture } from './Channel.fixture';
import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts, group } from './fakeData';

const post = createFakePosts(1)[0];

function MessageActions() {
  const [currentChannel, setCurrentChannel] = useState<db.Channel | null>(null);
  const refStub = createRef<View>();

  useEffect(() => {
    if (group) {
      const firstChatChannel = group.channels?.find((c) => c.type === 'chat');
      if (firstChatChannel) {
        setCurrentChannel(firstChatChannel);
      }
    }
  }, []);

  const [postActionIds] = useState(() =>
    currentChannel == null
      ? []
      : ChannelAction.channelActionIdsFor({ channel: currentChannel })
  );

  if (currentChannel) {
    return (
      <Modal visible={true} onDismiss={() => null}>
        <ChatMessageActions
          post={post}
          postActionIds={postActionIds}
          postRef={refStub}
          onDismiss={() => null}
        />
      </Modal>
    );
  }

  return null;
}

export default {
  light: (
    <FixtureWrapper fillHeight fillWidth>
      <ZStack flex={1}>
        <ChannelFixture />
        <MessageActions />
      </ZStack>
    </FixtureWrapper>
  ),
  dark: (
    <FixtureWrapper fillHeight fillWidth theme="dark">
      <ZStack flex={1}>
        <ChannelFixture theme="dark" />
        <MessageActions />
      </ZStack>
    </FixtureWrapper>
  ),
};
