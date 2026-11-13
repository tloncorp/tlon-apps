import type { MessageSearchHit } from '@tloncorp/api/client/messageSearch';
import { MessageSearchResult } from '../features/chat-list/MessageSearchResults';
import { FixtureWrapper } from './FixtureWrapper';

const hit: MessageSearchHit = {
  post: {
    id: 'search-example',
    channelId: 'chat/~sampel-palnet/general',
    authorId: '~nec',
    sentAt: Date.now(),
    receivedAt: Date.now(),
    type: 'reply',
    parentId: 'root',
    textContent:
      'This is the message you were looking for, with enough surrounding context to recognize the conversation.',
  },
  authorName: 'Galen',
  conversationTitle: 'Durable workspace · General',
};
export default {
  reply: (
    <FixtureWrapper fillWidth>
      <MessageSearchResult hit={hit} selected onSelect={() => {}} />
    </FixtureWrapper>
  ),
};
