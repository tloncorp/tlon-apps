import { decToUd, udToDec, unixToDa } from '@urbit/api';
import { uniq } from 'lodash';
import bigInt, { BigInteger } from 'big-integer';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import api from '@/api';
import {
  Pact,
  WritDiff,
  DmAction,
  newWritMap,
  WritSeal,
  Writ,
  Writs,
  WritInCache,
  WritResponse
} from '@/types/dms';
import { newReplyMap, Reply } from '@/types/channel';
import queryClient from '@/queryClient';
import { extendCurrentWindow, getWindow } from '@/logic/windows';
import { BasedChatState } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
  getNewer: (count: string, time?: string) => Promise<boolean>;
  getOlder: (count: string, time?: string) => Promise<boolean>;
  getAround: (count: string, time: string) => Promise<void>;
}

export function writsReducer(whom: string, optimistic = false) {
  return (json: WritDiff | WritResponse, draft: BasedChatState): BasedChatState => {
    let id: string | undefined;
    let delta;
    if ('response' in json) {
      id = json.id;
      delta = json.response;
    } else {
      id = json.id;
      delta = json.delta;
    }

    if (!delta || !id) {
      return draft;
    }

    const pact = draft.pacts[whom] || {
      index: {},
      writs: newWritMap(),
    };

    if ('add' in delta && !pact.index[id]) {
      const time = delta.add.time
        ? bigInt(delta.add.time)
        : unixToDa(Date.now());
      pact.index[id] = time;
      const seal: WritSeal = {
        id,
        time: time.toString(),
        reacts: {},
        replies: null,
        meta: {
          replyCount: 0,
          lastRepliers: [],
          lastReply: null,
        },
      };
      const writ: Writ = {
        seal,
        essay: {
          ...delta.add.memo,
          'kind-data': {
            chat: delta.add.kind,
          },
        },
      };
      pact.writs = pact.writs.with(time, writ);
      draft.writWindows[whom] = extendCurrentWindow(
        {
          oldest: time,
          newest: time,
          loadedNewest: true,
          loadedOldest: false,
        },
        draft.writWindows[whom]
      );
    } else if ('del' in delta && pact.index[id]) {
      const time = pact.index[id];
      pact.writs = pact.writs.without(time);
      delete pact.index[id];
    } else if ('add-react' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const { ship, react } = delta['add-react'];

      if (msg) {
        msg.seal.reacts[ship] = react;
        pact.writs = pact.writs.with(time, msg);
      }
    } else if ('del-react' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const ship = delta['del-react'];

      if (msg) {
        delete msg.seal.reacts[ship];

        pact.writs = pact.writs.with(time, {
          ...msg,
          seal: msg.seal,
        });
      }
    } else if ('reply' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const { reply } = delta;

      if (msg) {
        const replyDelta = reply.delta;

        if ('add' in replyDelta) {
          const currentPost = queryClient.getQueryData<WritInCache>([
            'dms',
            whom,
            id,
          ]);

          if (currentPost) {
            queryClient.invalidateQueries(['dms', whom, id]);
            const currentReplies = currentPost.seal.replies;
            const cachedReply = Object.entries(currentReplies).find(
              ([_, q]) => q.memo.sent === replyDelta.add.memo.sent
            );

            if (!cachedReply && replyDelta.add.memo.author === window.our) {
              return draft;
            }
          }

          if (optimistic) {
            msg.seal.meta.replyCount += 1;
            msg.seal.meta.lastRepliers = uniq([
              ...msg.seal.meta.lastRepliers,
              replyDelta.add.memo.author,
            ]);
            msg.seal.meta.lastReply = replyDelta.add.memo.sent;
          } else if (delta.reply.meta) {
            msg.seal.meta = delta.reply.meta;
          }

          pact.writs = pact.writs.with(time, msg);
        }
      }
    }
    draft.pacts[whom] = { ...pact };

    return draft;
  };
}

export function updatePact(whom: string, writs: Writs, draft: BasedChatState) {
  const pact: Pact = draft.pacts[whom] || {
    writs: newWritMap(),
    index: {},
  };

  const pairs = Object.entries(writs)
    .map<[BigInteger, Writ]>(([key, writ]) => [bigInt(udToDec(key)), writ])
    .filter(([key, writ]) => !pact.index[writ.seal.id] && !pact.writs.has(key));

  pact.writs.setPairs(pairs);
  pairs.forEach(([tim, writ]) => {
    pact.index[writ.seal.id] = tim;
  });

  pact.writs.mapValues((writ) => {
    const newWrit = { ...writ };
    if (writ.seal.replies) {
      if (Object.entries(writ.seal.replies).length === 0) {
        newWrit.seal.replies = null;

        return newWrit;
      }

      const replies = writ.seal.replies as unknown;

      if (replies && typeof replies === 'object' && 'with' in replies) {
        return newWrit;
      }

      newWrit.seal.replies = newReplyMap(replies as [BigInteger, Reply][]);

      return newWrit;
    }

    return newWrit;
  });

  draft.pacts[whom] = { ...pact };
}

export default function makeWritsStore(
  whom: string,
  get: () => BasedChatState,
  set: (fn: (draft: BasedChatState) => void) => void,
  scryPath: string,
  subPath: string
): WritsStore {
  const scry = <T>(path: string) =>
    api.scry<T>({
      app: 'chat',
      path: `${scryPath}${path}`,
    });

  const getMessages = async (
    count: string,
    dir: 'older' | 'newer',
    around?: string
  ) => {
    const { pacts, writWindows } = get();
    const pact = pacts[whom];

    if (!pact) {
      return false;
    }

    const oldMessagesSize = pact.writs.size ?? 0;
    if (oldMessagesSize === 0) {
      // already loading the graph
      return false;
    }

    const window = getWindow(writWindows[whom], around);
    if (!window) {
      return false;
    }
    const current = pact.writs.getRange(window.oldest, window.newest);
    const index =
      dir === 'newer' ? current[current.length - 1]?.[0] : current[0]?.[0];
    if (!index) {
      return false;
    }

    const fetchStart = decToUd(index.toString());
    const writs = await api.scry<Writs>({
      app: 'chat',
      path: `${scryPath}/${dir}/${fetchStart}/${count}/light`,
    });

    set((draft) => {
      updatePact(whom, writs, draft);
      // combine any overlapping windows so we have one continuous window
      const keys = Object.keys(writs).sort();
      const updates = keys.length > 0;
      const oldest = updates ? bigInt(udToDec(keys[0])) : window.oldest;
      const newest = updates
        ? bigInt(udToDec(keys[keys.length - 1]))
        : window.newest;
      draft.writWindows[whom] = extendCurrentWindow(
        {
          oldest,
          newest,
          loadedNewest:
            dir === 'newer'
              ? updates
                ? newest.eq(window.newest)
                : true
              : window.loadedNewest,
          loadedOldest: dir === 'older' ? !updates : window.loadedOldest,
        },
        draft.writWindows[whom],
        around
      );
    });

    const newMessageSize = get().pacts[whom].writs.size;
    return newMessageSize !== oldMessagesSize;
  };

  const updateAround = async (writs: Writs, time: string) => {
    get().batchSet((draft) => {
      const keys = Object.keys(writs).sort();
      if (keys.length === 0) {
        return;
      }

      updatePact(whom, writs, draft);
      const oldest = bigInt(udToDec(keys[0]));
      const newest = bigInt(udToDec(keys[keys.length - 1]));
      draft.writWindows[whom] = extendCurrentWindow(
        {
          oldest,
          newest,
          loadedNewest: false,
          loadedOldest: false,
        },
        draft.writWindows[whom],
        time
      );
    });
  };

  return {
    initialize: async () => {
      const writs = await scry<Writs>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/light`
      );

      get().batchSet((draft) => {
        const keys = Object.keys(writs).sort();
        const window = getWindow(draft.writWindows[whom]);
        const oldest = bigInt(udToDec(keys[0] || '0'));
        const newest = bigInt(udToDec(keys[keys.length - 1] || '0'));
        if (window && window.oldest.eq(oldest) && window.newest.eq(newest)) {
          return;
        }

        updatePact(whom, writs, draft);
        // combine any overlapping windows so we have one continuous window
        draft.writWindows[whom] = extendCurrentWindow(
          {
            oldest,
            newest,
            loadedNewest: true,
            loadedOldest: keys.length === 0,
            latest: true,
          },
          draft.writWindows[whom]
        );
      });

      api.subscribe({
        app: 'chat',
        path: subPath,
        event: (data: WritDiff | WritResponse, mark: string) => {
          if (mark !== 'writ-response') {
            return;
          }

          set((draft) => {
            writsReducer(whom)(data as WritResponse, draft);
            return {
              pacts: { ...draft.pacts },
              writWindows: { ...draft.writWindows },
              trackedMessages: draft.trackedMessages.map((msg) => {
                if (msg.id === data.id) {
                  return { status: 'delivered', id: data.id };
                }

                return msg;
              }),
            };
          });
        },
      });
    },
    getNewer: async (count, time) => getMessages(count, 'newer', time),
    getOlder: async (count, time) => getMessages(count, 'older', time),
    getAround: async (count, time) => {
      const writs = await api.scry<Writs>({
        app: 'chat',
        path: `${scryPath}/around/${decToUd(time.toString())}/${count}/light`,
      });
      updateAround(writs, time);
    },
  };
}
