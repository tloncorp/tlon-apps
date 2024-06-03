import {
  Activity,
  ActivitySummary,
} from '@tloncorp/shared/dist/urbit/activity';
import { Block } from '@tloncorp/shared/dist/urbit/channel';
import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

import { createDevLogger } from '@/logic/utils';

export interface ChatInfoUnread {
  readTimeout: number;
  seen: boolean;
  unread: ActivitySummary; // lags behind actual unread, only gets update if unread
}

export interface ChatInfo {
  replying: string | null;
  blocks: Block[];
  unread?: ChatInfoUnread;
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
  setBlocks: (whom: string, blocks: Block[]) => void;
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
  handleUnread: (whom: string, unread: ActivitySummary) => void;
  bottom: (atBottom: boolean) => void;
  setCurrent: (whom: string) => void;
  update: (unreads: Activity) => void;
}

const emptyInfo: () => ChatInfo = () => ({
  replying: null,
  blocks: [],
  unread: undefined,
  dialogs: {},
  hovering: '',
  failedToLoadContent: {},
});

export const chatStoreLogger = createDevLogger('ChatStore', false);

export function isUnread(unread: ActivitySummary): boolean {
  return unread.count > 0;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: {},
  current: '',
  atBottom: false,
  update: (unreads) => {
    set(
      produce((draft: ChatStore) => {
        Object.entries(unreads).forEach(([whom, unread]) => {
          const chat = draft.chats[whom];
          chatStoreLogger.log('update', whom, chat, unread, draft.chats);

          if (isUnread(unread)) {
            draft.chats[whom] = {
              ...(chat || emptyInfo()),
              unread: {
                seen: false,
                readTimeout: 0,
                unread,
              },
            };
            return;
          }

          if (!chat) {
            return;
          }

          delete chat.unread;
        });
      })
    );
  },
  setBlocks: (whom, blocks) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        chatStoreLogger.log('setBlocks', whom, blocks);
        draft.chats[whom].blocks = blocks;
      })
    );
  },
  setDialogs: (whom, writId, dialogs) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        chatStoreLogger.log('setDialogs', whom, dialogs);
        draft.chats[whom].dialogs[writId] = dialogs;
      })
    );
  },
  setFailedToLoadContent: (whom, writId, blockIndex, failureState) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        if (!draft.chats[whom].failedToLoadContent[writId]) {
          draft.chats[whom].failedToLoadContent[writId] = {};
        }

        draft.chats[whom].failedToLoadContent[writId][blockIndex] =
          failureState;

        chatStoreLogger.log(
          'setFailed',
          whom,
          JSON.stringify(draft.chats[whom].failedToLoadContent[writId])
        );
      })
    );
  },
  setHovering: (whom, writId, hovering) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        const newHovering = hovering ? writId : '';
        chatStoreLogger.log('setHovering', whom, newHovering);
        draft.chats[whom].hovering = newHovering;
      })
    );
  },
  reply: (whom, msgId) => {
    set(
      produce((draft) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        chatStoreLogger.log('reply', whom, msgId);
        draft.chats[whom].replying = msgId;
      })
    );
  },
  seen: (whom) => {
    set(
      produce((draft: ChatStore) => {
        if (!draft.chats[whom]) {
          draft.chats[whom] = emptyInfo();
        }

        const chat = draft.chats[whom];
        const unread = chat.unread || {
          unread: {
            recency: 0,
            count: 0,
            notify: false,
            unread: null,
            children: [],
          },
          readTimeout: 0,
        };

        chatStoreLogger.log('seen', whom);
        draft.chats[whom].unread = {
          ...unread,
          seen: true,
        };
      })
    );
  },
  read: (whom) => {
    set(
      produce((draft: ChatStore) => {
        const chat = draft.chats[whom];
        if (!chat) {
          return;
        }

        if (chat.unread && chat.unread.readTimeout) {
          chatStoreLogger.log('clear delayedRead', whom);
          clearTimeout(chat.unread.readTimeout);
        }

        chatStoreLogger.log('read', whom, JSON.stringify(chat));
        chat.unread = undefined;
        chatStoreLogger.log('post read', JSON.stringify(draft.chats[whom]));
      })
    );
  },
  delayedRead: (whom, cb) => {
    const { chats, read } = get();
    const chat = chats[whom] || emptyInfo();

    if (!chat.unread) {
      return;
    }

    if (chat.unread.readTimeout) {
      clearTimeout(chat.unread.readTimeout);
    }

    const readTimeout = setTimeout(() => {
      read(whom);
      cb();
    }, 15 * 1000); // 15 seconds

    set(
      produce((draft) => {
        const latest = draft.chats[whom] || emptyInfo();
        chatStoreLogger.log('delayedRead', whom, chat, latest);
        draft.chats[whom] = {
          ...latest,
          unread: {
            ...latest.unread,
            readTimeout,
          },
        };
      })
    );
  },
  handleUnread: (whom, unread) => {
    const hasUnreads = isUnread(unread);
    if (hasUnreads) {
      set(
        produce((draft: ChatStore) => {
          const chat = draft.chats[whom] || emptyInfo();

          /* TODO: there was initially logic here to mark read when we're on the chat and
            at the bottom of the scroll. This was very rarely firing since the scroller
            doesn't actually call that event very often and if it did, would clear thread
            unreads before they're seen. We should revisit once we have more granular control
            over what we mark read.
          */
          chatStoreLogger.log('unread', whom, chat, unread);
          draft.chats[whom] = {
            ...chat,
            unread: {
              seen: false,
              readTimeout: 0,
              unread,
            },
          };
        })
      );
    } else {
      get().read(whom);
    }
  },
  setCurrent: (current) => {
    set(
      produce((draft) => {
        chatStoreLogger.log('current', current);
        draft.current = current;
      })
    );
  },
  bottom: (atBottom) => {
    set(
      produce((draft) => {
        chatStoreLogger.log('atBottom', atBottom);
        draft.atBottom = atBottom;
      })
    );
  },
}));

const defaultInfo = { replying: null, blocks: [] };
export function useChatInfo(flag: string): ChatInfo {
  return useChatStore(useCallback((s) => s.chats[flag] || defaultInfo, [flag]));
}

export function useChatKeys(): string[] {
  return useChatStore(useCallback((s) => Object.keys(s.chats), []));
}

export function fetchChatBlocks(whom: string): Block[] {
  return useChatStore.getState().chats[whom]?.blocks || [];
}

export function useChatBlocks(whom?: string): Block[] {
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

export function useChatDialogs(
  whom: string,
  writId: string
): Record<string, boolean> {
  return useChatStore(
    useCallback((s) => s.chats[whom]?.dialogs?.[writId] || {}, [whom, writId])
  );
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

interface UnreadInfo {
  unread: boolean;
  count: number;
  notify: boolean;
}

const defaultUnread = {
  unread: false,
  count: 0,
  notify: false,
};

export function useCombinedChatUnreads() {
  const chats = useChatStore(useCallback((s) => s.chats, []));
  return Object.entries(chats).reduce((acc, [whom, chat]) => {
    const unread = chat.unread?.unread;
    if (!unread) {
      return acc;
    }

    return {
      unread: acc.unread || isUnread(unread),
      count: acc.count + unread.count,
      notify: acc.notify || unread.notify,
    };
  }, defaultUnread);
}

export function useChatUnread(whom: string): ChatInfoUnread | undefined {
  return useChatStore(useCallback((s) => s.chats[whom]?.unread, [whom]));
}

window.chatstore = useChatStore;
