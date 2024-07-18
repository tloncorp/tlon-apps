import { ChannelDivider, ChatMessage } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts } from './fakeData';

const posts = createFakePosts(100);

export default (
  <FixtureWrapper fillWidth={true} verticalAlign="center">
    <ChannelDivider index={0} post={posts[0]} unreadCount={0} />
    <ChatMessage
      showAuthor={true}
      showReplies={true}
      post={posts[0]}
    ></ChatMessage>
    <ChannelDivider index={0} post={posts[1]} unreadCount={3} />
    <ChatMessage
      post={posts[1]}
      showAuthor={true}
      showReplies={true}
    ></ChatMessage>
  </FixtureWrapper>
);
