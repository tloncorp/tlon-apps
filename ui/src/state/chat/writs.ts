import { BigIntOrderedMap, udToDec, unixToDa } from '@urbit/api';
import bigInt from 'big-integer';
import api from '../../api';
import { ChatWrit, ChatWrits, Pact, WritDiff } from '../../types/chat';
import { ChatState } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
  getOlder: (start: string, count: string) => Promise<void>;
}

export default function makeWritsStore(
  whom: string,
  get: () => ChatState,
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
      const writs = await scry<ChatWrits>(`/newest/100`);
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
        event: (data: unknown) => {
          const { id, delta } = data as WritDiff;
          const s = get();
          s.batchSet((draft) => {
            const pact = draft.pacts[whom];
            if ('add' in delta) {
              const time = bigInt(unixToDa(Date.now()));
              draft.pacts[whom].index[id] = time;
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
            } else if ('del' in delta) {
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
              // const time = bigInt(udToDec(delta.del));
              // draft.dms[ship].writs = draft.dms[ship].writs.delete(time);
            } else if ('add-feel' in delta) {
              // TODO: map from rcv -> id
              /*  
             * const d = delta['add-feel'];
            const time = bigInt(udToDec(d.time));
            const writ = draft.dms[ship].writs.get(time);
            writ.seal.feels[d.ship] = d.feel;
            draft.dms[ship].writs = draft.dms[ship].writs.set(time, writ);
            */
            }
            draft.pacts[whom] = pact;
          });
        },
      });
    },
    getOlder: async (start: string, count: string) => {
      // TODO: fix for group chats
      const writs = await api.scry<ChatWrits>({
        app: 'chat',
        path: `/dm/${whom}/writs/older/${start}/${count}`,
      });
      const { batchSet, pacts } = get();
      const pact = pacts[whom];
      batchSet((draft) => {
        Object.keys(writs).forEach((key) => {
          const writ = writs[key];
          const tim = bigInt(udToDec(key));
          pact.writs = pact.writs.set(tim, writ);
          pact.index[writ.seal.id] = tim;
        });
        draft.pacts[whom] = pact;
      });
    },
  };
}
