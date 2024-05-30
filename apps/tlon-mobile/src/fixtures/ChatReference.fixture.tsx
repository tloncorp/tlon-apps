import ChatReference from '@tloncorp/ui/src/components/ContentReference/ChatReference';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost, tlonLocalSupport } from './fakeData';

const fakePost = createFakePost();

const ChatReferenceFixture = () => (
  <FixtureWrapper fillWidth>
    <ChatReference
      post={fakePost}
      channel={tlonLocalSupport}
      onPress={() => ({})}
    />
  </FixtureWrapper>
);

export default ChatReferenceFixture;
