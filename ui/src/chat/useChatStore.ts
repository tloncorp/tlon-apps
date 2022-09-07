import { ChatBlock } from '@/types/chat';
import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

export interface ChatInfo {
  replying: string | null;
  blocks: ChatBlock[];
}

interface ChatStore {
  chats: {
    [flag: string]: ChatInfo;
  };
  reply: (flag: string, msgId: string | null) => void;
  setBlocks: (whom: string, blocks: ChatBlock[]) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: {},
  setBlocks: (whom, blocks) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = { replying: null, blocks };
        } else {
          draft.chats[whom].blocks = blocks;
        }
      })
    );
  },
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

const defaultInfo = { replying: null, blocks: [] };
export function useChatInfo(flag: string): ChatInfo {
  return useChatStore(useCallback((s) => s.chats[flag] || defaultInfo, [flag]));
}

export function fetchChatBlocks(whom: string): ChatBlock[] {
  return useChatStore.getState().chats[whom]?.blocks || [];
}
