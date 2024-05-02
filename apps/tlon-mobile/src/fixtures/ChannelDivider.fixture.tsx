import { ChannelDivider, ChatMessage } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts } from './fakeData';

const posts = createFakePosts(100);

export default (
  <FixtureWrapper fillWidth={true} verticalAlign="center">
    <ChatMessage
      showAuthor={true}
      showReplies={true}
      currentUserId="~solfer-magfed"
      post={posts[0]}
    ></ChatMessage>
    <ChannelDivider timestamp={Date.now()} unreadCount={3} />
    <ChatMessage
      currentUserId="~solfer-magfed"
      post={posts[1]}
      showAuthor={true}
      showReplies={true}
    ></ChatMessage>
  </FixtureWrapper>
);
