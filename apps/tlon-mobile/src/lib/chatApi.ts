import { poke } from './api';

export const markChatRead = (whom: string) =>
  poke({
    app: 'chat',
    mark: 'chat-remark-action',
    json: {
      whom,
      diff: { read: null },
    },
  });
