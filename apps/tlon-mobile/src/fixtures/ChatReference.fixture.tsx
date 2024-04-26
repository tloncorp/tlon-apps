import ChatReference from '@tloncorp/ui/src/components/ContentReference/ChatReference';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost, tlonLocalSupport } from './fakeData';

const fakePost = createFakePost();

const fakeContent = JSON.parse(fakePost.content as string);

const ChatReferenceFixture = () => (
  <FixtureWrapper fillWidth>
    <ChatReference
      post={fakePost}
      channel={tlonLocalSupport}
      content={fakeContent}
      navigate={() => ({})}
    />
  </FixtureWrapper>
);

export default ChatReferenceFixture;
