import type * as db from '@tloncorp/shared/db';

import type { MockSender } from './mockConversation';

// Builds a minimal `db.Post` suitable for rendering via StaticChatMessage.
// `content` uses the urbit `ub.Story` shape that the content parser expects:
// an array of verses like `{ inline: ['text'] }`.
export function buildMockPost({
  index,
  sender,
  text,
  shipIds,
  sentAt,
}: {
  index: number;
  sender: MockSender;
  text: string;
  shipIds: Record<MockSender, string>;
  sentAt: number;
}): db.Post {
  return {
    id: `preview-${index}`,
    type: 'chat',
    authorId: shipIds[sender],
    sentAt,
    receivedAt: sentAt,
    channelId: 'preview-channel',
    parentId: null,
    content: JSON.stringify([{ inline: [text] }]),
    textContent: text,
    images: [],
    reactions: [],
    replies: [],
    hidden: false,
    syncedAt: 0,
    isBot: sender === 'bot',
  } as db.Post;
}
