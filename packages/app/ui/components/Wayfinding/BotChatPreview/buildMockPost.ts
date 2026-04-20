import type * as db from '@tloncorp/shared/db';

import type { MockSender } from './mockConversation';

// Builds a minimal `db.Post` suitable for rendering via StaticChatMessage.
// `content` uses the urbit `ub.Story` shape that the content parser expects:
// an array of verses like `{ inline: ['text'] }`.
export function buildMockPost({
  index,
  sender,
  text,
  userShipId,
  botShipId,
  sentAt,
}: {
  index: number;
  sender: MockSender;
  text: string;
  userShipId: string;
  botShipId: string;
  sentAt: number;
}): db.Post {
  const authorId = sender === 'bot' ? botShipId : userShipId;
  return {
    id: `preview-${index}`,
    type: 'chat',
    authorId,
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
