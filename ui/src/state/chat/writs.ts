import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import bigInt from 'big-integer';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import api from '../../api';
import {
  ChatWrit,
  ChatWrits,
  Pact,
  WritDiff,
  ChatAction,
} from '../../types/chat';
import { BasedChatState } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
  getNewer: (count: string) => Promise<boolean>;
  getOlder: (count: string) => Promise<boolean>;
}

export function writsReducer(whom: string) {
  return (
    json: ChatAction | WritDiff,
    draft: BasedChatState
  ): BasedChatState => {
    let id;
    let delta;
    if ('update' in json) {
      if ('writs' in json.update.diff) {
        id = json.update.diff.writs.id;
        delta = json.update.diff.writs.delta;
      }
    } else {
      id = json.id;
      delta = json.delta;
    }
    if (!delta || !id) {
      return draft;
    }

    const pact = draft.pacts[whom];

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
          ancestor.seal.replied = ancestor.seal.replied.filter(
            (r) => r !== old.memo.replying
          );
          pact.writs.set(replyTime, ancestor);
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
  return {
    initialize: async () => {
      const writs = await scry<ChatWrits>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}`
      );
      const sta = get();
      sta.batchSet((draft) => {
        const pact: Pact = {
          writs: new BigIntOrderedMap<ChatWrit>(),
          index: {},
        };
        Object.keys(writs).forEach((key) => {
          const writ = writs[key];
          const tim = bigInt(udToDec(key));
          pact.writs = pact.writs.set(tim, writ);
          pact.index[writ.seal.id] = tim;
        });
        draft.pacts[whom] = pact;
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
    getNewer: async (count: string) => {
      // TODO: fix for group chats
      const { pacts } = get();
      const pact = pacts[whom];

      if (!pact) {
        return false;
      }

      const oldMessagesSize = pact.writs.size ?? 0;
      if (oldMessagesSize === 0) {
        // already loading the graph
        return false;
      }

      const index = pact.writs.peekLargest()?.[0];
      if (!index) {
        return false;
      }

      const newest = pact.writs.peekLargest()[0];
      const fetchStart = decToUd(newest.toString());

      const writs = await api.scry<ChatWrits>({
        app: 'chat',
        path: `${scryPath}/newer/${fetchStart}/${count}`,
      });

      get().batchSet((draft) => {
        Object.keys(writs).forEach((key) => {
          const writ = writs[key];
          const tim = bigInt(udToDec(key));
          pact.writs = pact.writs.set(tim, writ);
          pact.index[writ.seal.id] = tim;
        });
        draft.pacts[whom] = { ...pact };
        const loaded = draft.loadedWrits[whom] || {
          oldest: unixToDa(Date.now()),
          newest: unixToDa(0),
        };
        draft.loadedWrits[whom] = { ...loaded, newest };
      });

      const newMessageSize = get().pacts[whom].writs.size;
      return newMessageSize !== oldMessagesSize;
    },
    getOlder: async (count: string) => {
      // TODO: fix for group chats
      const { pacts, batchSet } = get();
      const pact = pacts[whom];

      if (!pact) {
        return false;
      }

      const oldMessagesSize = pact.writs.size ?? 0;
      if (oldMessagesSize === 0) {
        // already loading the graph
        return false;
      }

      const index = pact.writs.peekSmallest()?.[0];
      if (!index) {
        return false;
      }

      const oldest = pact.writs.peekSmallest()[0];
      const fetchStart = decToUd(oldest.toString());

      const writs = await api.scry<ChatWrits>({
        app: 'chat',
        path: `${scryPath}/older/${fetchStart}/${count}`,
      });

      batchSet((draft) => {
        Object.keys(writs).forEach((key) => {
          const writ = writs[key];
          const tim = bigInt(udToDec(key));
          pact.writs = pact.writs.set(tim, writ);
          pact.index[writ.seal.id] = tim;
        });
        draft.pacts[whom] = { ...pact };
        const loaded = draft.loadedWrits[whom] || {
          oldest: unixToDa(Date.now()),
          newest: unixToDa(0),
        };
        draft.loadedWrits[whom] = { ...loaded, oldest };
      });

      const newMessageSize = get().pacts[whom].writs.size;
      return newMessageSize === oldMessagesSize;
    },
  };
}
