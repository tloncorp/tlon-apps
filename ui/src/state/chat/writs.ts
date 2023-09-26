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
  WritDelta,
  WritInCache,
} from '@/types/dms';
import { newQuipMap, Quip } from '@/types/channel';
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
  return (json: DmAction | WritDiff, draft: BasedChatState): BasedChatState => {
    let id: string | undefined;
    let delta: WritDelta;
    if ('diff' in json) {
      id = json.diff.id;
      delta = json.diff.delta;
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
      const now = delta.add.time || Date.now();
      const time = bigInt(unixToDa(now));
      pact.index[id] = time;
      const seal: WritSeal = {
        id,
        time: now,
        feels: {},
        quips: null,
        meta: {
          quipCount: 0,
          lastQuippers: [],
          lastQuip: null,
        },
      };
      const writ: Writ = {
        seal,
        essay: {
          ...delta.add.memo,
          'han-data': {
            chat: delta.add.kind,
          },
        },
      };
      pact.writs = pact.writs.with(time, writ);
      draft.writWindows[whom] = extendCurrentWindow(
        {
          oldest: time,
          newest: time,
          loadedNewest: false,
          loadedOldest: false,
        },
        draft.writWindows[whom]
      );
    } else if ('del' in delta && pact.index[id]) {
      const time = pact.index[id];
      pact.writs = pact.writs.without(time);
      delete pact.index[id];
    } else if ('add-feel' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const { ship, feel } = delta['add-feel'];

      if (msg) {
        msg.seal.feels[ship] = feel;
        pact.writs = pact.writs.with(time, msg);
      }
    } else if ('del-feel' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const ship = delta['del-feel'];

      if (msg) {
        delete msg.seal.feels[ship];

        pact.writs = pact.writs.with(time, {
          ...msg,
          seal: msg.seal,
        });
      }
    } else if ('quip' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const { quip } = delta;

      if (msg) {
        const quipDelta = quip.delta;

        if ('add' in quipDelta) {
          const currentNote = queryClient.getQueryData<WritInCache>([
            'dms',
            whom,
            id,
          ]);

          if (currentNote) {
            queryClient.invalidateQueries(['dms', whom, id]);
            const currentQuips = currentNote.seal.quips;
            const cachedQuip = Object.entries(currentQuips).find(
              ([_, q]) => q.memo.sent === quipDelta.add.memo.sent
            );

            if (!cachedQuip && quipDelta.add.memo.author === window.our) {
              return draft;
            }
          }

          if (optimistic) {
            msg.seal.meta.quipCount += 1;
            msg.seal.meta.lastQuippers = uniq([
              ...msg.seal.meta.lastQuippers,
              quipDelta.add.memo.author,
            ]);
            msg.seal.meta.lastQuip = quipDelta.add.memo.sent;
          } else if (delta.quip.meta) {
            msg.seal.meta = delta.quip.meta;
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
    if (writ.seal.quips) {
      if (Object.entries(writ.seal.quips).length === 0) {
        newWrit.seal.quips = null;

        return newWrit;
      }

      const quips = writ.seal.quips as unknown;

      if (quips && typeof quips === 'object' && 'with' in quips) {
        return newWrit;
      }

      newWrit.seal.quips = newQuipMap(quips as [BigInteger, Quip][]);

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
          loadedNewest: dir === 'newer' ? !updates : window.loadedNewest,
          loadedOldest: dir === 'older' ? !updates : window.loadedOldest,
        },
        draft.writWindows[whom],
        around
      );
    });

    const newMessageSize = get().pacts[whom].writs.size;
    return newMessageSize !== oldMessagesSize;
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
            loadedOldest: false,
            latest: true,
          },
          draft.writWindows[whom]
        );
      });

      api.subscribe({
        app: 'chat',
        path: subPath,
        event: (data: WritDiff) => {
          set((draft) => {
            writsReducer(whom)(data, draft);
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
    },
  };
}
