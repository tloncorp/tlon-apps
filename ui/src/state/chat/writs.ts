import _ from 'lodash';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { sliceMap } from '@/logic/utils';
import api from '@/api';
import {
  ChatWrit,
  ChatWrits,
  Pact,
  WritDiff,
  ChatAction,
  DmAction,
} from '@/types/chat';
import { BasedChatState, WritWindow, WritWindows } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
  getNewer: (count: string, time?: BigInteger) => Promise<boolean>;
  getOlder: (count: string, time?: BigInteger) => Promise<boolean>;
  getAround: (count: string, time: BigInteger) => Promise<void>;
}

export function writsReducer(whom: string) {
  return (
    json: ChatAction | DmAction | WritDiff,
    draft: BasedChatState
  ): BasedChatState => {
    let id: string | undefined;
    let delta;
    if ('update' in json) {
      if ('writs' in json.update.diff) {
        id = json.update.diff.writs.id;
        delta = json.update.diff.writs.delta;
      }
    } else if ('diff' in json) {
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
      writs: new BigIntOrderedMap<ChatWrit>(),
    };

    if ('add' in delta && !pact.index[id]) {
      const time = bigInt(unixToDa(Date.now()));
      pact.index[id] = time;
      const seal = { id, feels: {}, replied: [] };
      const writ = { seal, memo: delta.add };
      pact.writs = pact.writs.set(time, writ);
      if (delta.add.replying) {
        const replyTime = pact.index[delta.add.replying];
        if (replyTime) {
          const ancestor = pact.writs.get(replyTime);
          ancestor.seal.replied = [...ancestor.seal.replied, id];
          pact.writs.set(replyTime, ancestor);
        }
      }
    } else if ('del' in delta && pact.index[id]) {
      const time = pact.index[id];
      const old = pact.writs.get(time);
      pact.writs = pact.writs.delete(time);
      delete pact.index[id];
      if (old.memo.replying) {
        const replyTime = pact.index[old.memo.replying];
        if (replyTime) {
          const ancestor = pact.writs.get(replyTime);
          ancestor.seal.replied = ancestor.seal.replied.filter((r) => r !== id);
          pact.writs = pact.writs.set(replyTime, ancestor);
        }
      }
    } else if ('add-feel' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const { ship, feel } = delta['add-feel'];

      pact.writs = pact.writs.set(time, {
        ...msg,
        seal: {
          ...msg.seal,
          feels: {
            ...msg.seal.feels,
            [ship]: feel,
          },
        },
      });
    } else if ('del-feel' in delta && pact.index[id]) {
      const time = pact.index[id];
      const msg = pact.writs.get(time);
      const ship = delta['del-feel'];
      delete msg.seal.feels[ship];

      pact.writs = pact.writs.set(time, {
        ...msg,
        seal: msg.seal,
      });
    }
    draft.pacts[whom] = pact;

    return draft;
  };
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
      latest: newWindow.latest ? newWindow : undefined,
      windows: [newWindow],
    };
  }

  console.log('old', JSON.parse(JSON.stringify(windows.windows)));
  console.log('new window', newWindow);
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

  console.log('new', JSON.parse(JSON.stringify(newWindows)));
  const combined = combineWindows(
    newWindows.sort((a, b) => {
      return (
        a.newest.subtract(b.newest).toJSNumber() ||
        a.oldest.subtract(b.oldest).toJSNumber()
      );
    })
  );

  return {
    latest: combined.find((w) => w.latest),
    windows: combined,
  };
}

export function updatePact(
  whom: string,
  writs: ChatWrits,
  draft: BasedChatState
) {
  const pact: Pact = draft.pacts[whom] || {
    writs: new BigIntOrderedMap<ChatWrit>(),
    index: {},
  };
  Object.keys(writs).forEach((key) => {
    const writ = writs[key];
    const tim = bigInt(udToDec(key));

    if (!pact.index[writ.seal.id]) {
      pact.writs = pact.writs.set(tim, writ);
      pact.index[writ.seal.id] = tim;
    }
  });
  draft.pacts[whom] = { ...pact };
}

export default function makeWritsStore(
  whom: string,
  get: () => BasedChatState,
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
    const current = sliceMap(pact.writs, window.oldest, window.newest);
    const index =
      dir === 'newer'
        ? current.peekLargest()?.[0]
        : current.peekSmallest()?.[0];
    if (!index) {
      return false;
    }

    const fetchStart = decToUd(index.toString());
    const writs = await api.scry<ChatWrits>({
      app: 'chat',
      path: `${scryPath}/${dir}/${fetchStart}/${count}`,
    });

    get().batchSet((draft) => {
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
      const writs = await scry<ChatWrits>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}`
      );

      get().batchSet((draft) => {
        const keys = Object.keys(writs).sort();
        if (keys.length === 0) {
          return;
        }

        const window = getWritWindow(draft.writWindows[whom]);
        const oldest = bigInt(udToDec(keys[0]));
        const newest = bigInt(udToDec(keys[keys.length - 1]));
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
          get().batchSet((draft) => {
            writsReducer(whom)(data, draft);
            draft.sentMessages = draft.sentMessages.filter(
              (id) => id !== data.id
            );
          });
        },
      });
    },
    getNewer: async (count, time) => getMessages(count, 'newer', time),
    getOlder: async (count, time) => getMessages(count, 'older', time),
    getAround: async (count, time) => {
      const writs = await api.scry<ChatWrits>({
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
