import { ChatBlock, ChatBrief } from '@/types/chat';
import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

export interface ChatInfo {
  replying: string | null;
  blocks: ChatBlock[];
  unread?: {
    readTimeout: number;
    seen: boolean;
    brief: ChatBrief; // lags behind actual brief, only gets update if unread
  };
  dialogs: Record<string, Record<string, boolean>>;
  hovering: string;
  failedToLoadContent: Record<string, Record<number, boolean>>;
}

export interface ChatStore {
  chats: {
    [flag: string]: ChatInfo;
  };
  atBottom: boolean;
  current: string;
  reply: (flag: string, msgId: string | null) => void;
  setBlocks: (whom: string, blocks: ChatBlock[]) => void;
  setDialogs: (
    whom: string,
    writId: string,
    dialogs: Record<string, boolean>
  ) => void;
  setFailedToLoadContent: (
    whom: string,
    writId: string,
    blockIndex: number,
    failureState: boolean
  ) => void;
  setHovering: (whom: string, writId: string, hovering: boolean) => void;
  seen: (whom: string) => void;
  read: (whom: string) => void;
  delayedRead: (whom: string, callback: () => void) => void;
  unread: (whom: string, brief: ChatBrief) => void;
  bottom: (atBottom: boolean) => void;
  setCurrent: (whom: string) => void;
}

const emptyInfo: ChatInfo = {
  replying: null,
  blocks: [],
  unread: undefined,
  dialogs: {},
  hovering: '',
  failedToLoadContent: {},
};

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: {},
  atBottom: false,
  current: '',
  setBlocks: (whom, blocks) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        draft.chats[whom].blocks = blocks;
      })
    );
  },
  setDialogs: (whom, writId, dialogs) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        draft.chats[whom].dialogs[writId] = dialogs;
      })
    );
  },
  setFailedToLoadContent: (whom, writId, blockIndex, failureState) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        if (!draft.chats[whom].failedToLoadContent[writId]) {
          draft.chats[whom].failedToLoadContent[writId] = {};
        }

        draft.chats[whom].failedToLoadContent[writId][blockIndex] =
          failureState;
      })
    );
  },
  setHovering: (whom, writId, hovering) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        draft.chats[whom].hovering = hovering ? writId : '';
      })
    );
  },
  reply: (whom, msgId) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        draft.chats[whom].replying = msgId;
      })
    );
  },
  seen: (whom) => {
    set(
      produce((draft: ChatStore) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo;
        }

        const chat = draft.chats[whom];
        const unread = chat.unread || {
          brief: { last: 0, count: 0, 'read-id': '' },
          readTimeout: 0,
        };

        draft.chats[whom].unread = {
          ...unread,
          seen: true,
        };
      })
    );
  },
  read: (whom) => {
    set(
      produce((draft) => {
        const chat = draft.chats[whom];
        if (!chat) {
          return;
        }

        delete chat.unread;
      })
    );
  },
  delayedRead: (whom, cb) => {
    const { chats, read } = get();
    const chat = chats[whom] || emptyInfo;

    if (!chat.unread || chat.unread.readTimeout) {
      return;
    }

    const readTimeout = setTimeout(() => {
      read(whom);
      cb();
    }, 15 * 1000); // 15 seconds

    set(
      produce((draft) => {
        draft.chats[whom] = {
          ...chat,
          unread: {
            ...chat.unread,
            readTimeout,
          },
        };
      })
    );
  },
  unread: (whom, brief) => {
    set(
      produce((draft: ChatStore) => {
        const chat = draft.chats[whom] || emptyInfo;

        draft.chats[whom] = {
          ...chat,
          unread: {
            seen: false,
            readTimeout: 0,
            brief,
          },
        };
      })
    );
  },
  setCurrent: (current) => {
    set(
      produce((draft) => {
        draft.current = current;
      })
    );
  },
  bottom: (atBottom) => {
    set(
      produce((draft) => {
        draft.atBottom = atBottom;
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

export function useChatBlocks(whom?: string): ChatBlock[] {
  return useChatStore(
    useCallback((s) => (whom ? s.chats[whom]?.blocks || [] : []), [whom])
  );
}

export function useChatDialog(
  whom: string,
  writId: string,
  dialog: string
): { open: boolean; setOpen: (open: boolean) => void } {
  const { setDialogs } = useChatStore.getState();
  const dialogs = useChatStore(
    useCallback((s) => s.chats[whom]?.dialogs?.[writId] || {}, [whom, writId])
  );

  return {
    open: dialogs[dialog] || false,
    setOpen: (open: boolean) => {
      setDialogs(whom, writId, { ...dialogs, [dialog]: open });
    },
  };
}

export function useChatHovering(
  whom: string,
  writId: string
): { hovering: boolean; setHovering: (hovering: boolean) => void } {
  const { setHovering } = useChatStore.getState();
  const hovering = useChatStore(
    useCallback((s) => s.chats[whom]?.hovering === writId, [whom, writId])
  );

  return {
    hovering,
    setHovering: (hover: boolean) => {
      setHovering(whom, writId, hover);
    },
  };
}

export function useChatFailedToLoadContent(
  whom: string,
  writId: string,
  blockIndex: number
): { failedToLoad: boolean; setFailedToLoad: (failed: boolean) => void } {
  const { setFailedToLoadContent } = useChatStore.getState();
  const failedToLoadContent = useChatStore(
    useCallback(
      (s) =>
        s.chats[whom]?.failedToLoadContent?.[writId]?.[blockIndex] || false,
      [whom, writId, blockIndex]
    )
  );

  return {
    failedToLoad: failedToLoadContent,
    setFailedToLoad: (failed: boolean) => {
      setFailedToLoadContent(whom, writId, blockIndex, failed);
    },
  };
}
