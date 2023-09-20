import _ from 'lodash';
import { decToUd, udToDec, unixToDa } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { newNoteMap, Note, Notes, NoteSeal } from '@/types/channel';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import api from '@/api';
import { Pact, WritDiff, DmAction, newWritMap } from '@/types/chat';
import { BasedChatState, WritWindow, WritWindows } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
  getNewer: (count: string, time?: BigInteger) => Promise<boolean>;
  getOlder: (count: string, time?: BigInteger) => Promise<boolean>;
  getAround: (count: string, time: BigInteger) => Promise<void>;
}

export const emptyWindow: WritWindow = {
  oldest: unixToDa(Date.now()),
  newest: bigInt(0),
  loadedOldest: false,
  loadedNewest: false,
};
export const emptyWindows: WritWindows = {
  latest: emptyWindow,
  windows: [emptyWindow],
};

function inWindow(window: WritWindow, time: BigInteger) {
  return time.geq(window.oldest) && time.leq(window.newest);
}

export function getWritWindow(window?: WritWindows, time?: BigInteger) {
  if (!window) {
    return undefined;
  }

  if (!time) {
    return window.latest;
  }

  for (let i = 0; i <= window.windows.length - 1; i += 1) {
    if (inWindow(window.windows[i], time)) {
      return window.windows[i];
    }
  }

  return undefined;
}

export function combineWindows(windows: WritWindow[]) {
  const result: WritWindow[] = [];
  let last: WritWindow;

  _.forEachRight(windows, (r) => {
    if (!last || r.newest.lt(last.oldest)) {
      result.unshift((last = r));
    } else if (r.oldest.lt(last.oldest)) {
      last.oldest = r.oldest;
      last.latest = last.latest || r.latest;
      last.loadedOldest = r.loadedOldest;
    }
  });

  return result;
}

function extendCurrentWindow(
  newWindow: WritWindow,
  windows?: WritWindows,
  time?: BigInteger
) {
  if (!windows) {
    return {
      latest: newWindow.latest || !time ? newWindow : undefined,
      windows: [newWindow],
    };
  }

  const current = getWritWindow(windows, time);
  const areEqual = (a: WritWindow, b: WritWindow) =>
    a.oldest.eq(b.oldest) && a.newest.eq(b.newest);
  const newWindows =
    current && windows.windows.some((w) => areEqual(w, current))
      ? windows.windows.map((w) => {
          if (areEqual(w, current)) {
            return {
              ...newWindow,
              latest: newWindow.latest || w.latest,
              newest: newWindow.newest.gt(w.newest)
                ? newWindow.newest
                : w.newest,
              oldest: newWindow.oldest.lt(w.oldest)
                ? newWindow.oldest
                : w.oldest,
            };
          }
          return w;
        })
      : [...windows.windows, newWindow];

  const combined = combineWindows(
    newWindows.sort(
      (a, b) =>
        a.newest.subtract(b.newest).toJSNumber() ||
        a.oldest.subtract(b.oldest).toJSNumber()
    )
  );

  return {
    latest: combined.find((w) => w.latest),
    windows: combined,
  };
}

export function writsReducer(whom: string) {
  return (json: DmAction | WritDiff, draft: BasedChatState): BasedChatState => {
    let id: string | undefined;
    let delta;
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
      const time = bigInt(unixToDa(Date.now()));
      pact.index[id] = time;
      const seal: NoteSeal = {
        id,
        feels: {},
        quips: null,
        meta: {
          quipCount: 0,
          lastQuippers: [],
          lastQuip: null,
        },
      };
      const writ = { seal, essay: delta.add };
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
      // const old = pact.writs.get(time);
      pact.writs = pact.writs.without(time);
      delete pact.index[id];
      // if (old && old.memo.replying) {
      // const replyTime = pact.index[old.memo.replying];
      // if (replyTime) {
      // const ancestor = pact.writs.get(replyTime);
      // if (ancestor) {
      // ancestor.seal.replied = ancestor.seal.replied.filter(
      // (r) => r !== id
      // );
      // pact.writs = pact.writs.with(replyTime, ancestor);
      // }
      // }
      // }
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
    }
    draft.pacts[whom] = { ...pact };

    return draft;
  };
}

export function updatePact(whom: string, writs: Notes, draft: BasedChatState) {
  const pact: Pact = draft.pacts[whom] || {
    writs: newNoteMap(),
    index: {},
  };

  const pairs = Object.entries(writs)
    .filter(([, writ]) => writ !== null)
    .map<[BigInteger, Note]>(([key, writ]) => [bigInt(udToDec(key)), writ!])
    .filter(([, writ]) => !pact.index[writ.seal.id]);

  pact.writs.setPairs(pairs);
  pairs.forEach(([tim, writ]) => {
    pact.index[writ.seal.id] = tim;
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
    around?: BigInteger
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

    const window = getWritWindow(writWindows[whom], around);
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
    const writs = await api.scry<Notes>({
      app: 'chat',
      path: `${scryPath}/${dir}/${fetchStart}/${count}`,
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
      const writs = await scry<Notes>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}`
      );

      get().batchSet((draft) => {
        const keys = Object.keys(writs).sort();
        const window = getWritWindow(draft.writWindows[whom]);
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
      const writs = await api.scry<Notes>({
        app: 'chat',
        path: `${scryPath}/around/${decToUd(time.toString())}/${count}`,
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
