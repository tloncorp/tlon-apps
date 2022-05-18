import produce from 'immer';
import _ from 'lodash';
import { useCallback } from 'react';
import create from 'zustand';

export interface ChatReplying {
  replying: string | null;
}

interface ChatStore {
  chats: {
    [flag: string]: ChatReplying;
  };
  reply: (flag: string, msgId: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: {},
  reply: (flag, msgId) => {
    set(
      produce((draft) => {
        if (!draft.chats[flag]) {
          draft.chats[flag] = { replying: msgId };
        } else {
          draft.chats[flag].replying = msgId;
        }
      })
    );
  },
}));

export function useChat(flag: string) {
  return useChatStore(useCallback((s) => s.chats[flag], [flag]));
}
