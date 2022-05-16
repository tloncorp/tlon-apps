import { BigIntOrderedMap, udToDec, unixToDa } from '@urbit/api';
import bigInt from 'big-integer';
import api from '../../api';
import { ChatWrit, ChatWrits, WritDiff } from '../../types/chat';
import { ChatState } from './type';

interface WritsStore {
  initialize: () => Promise<void>;
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
        let map = draft.writs[whom] || new BigIntOrderedMap<ChatWrit>();
        Object.keys(writs).forEach((key) => {
          const writ = writs[key];
          const tim = bigInt(udToDec(key));
          map = map.set(tim, writ);
        });
        draft.writs[whom] = map;
      });

      api.subscribe({
        app: 'chat',
        path: subPath,
        event: (data: unknown) => {
          const { id, delta } = data as WritDiff;
          const s = get();
          s.batchSet((draft) => {
            let map = draft.writs[whom];
            if ('add' in delta) {
              const time = bigInt(unixToDa(Date.now()));
              const seal = { time: time.toString(), feels: {} };
              const writ = { seal, memo: delta.add };
              map = map.set(time, writ);
            } else if ('del' in delta) {
              // TODO: map from rcv -> id
              // const time = bigInt(udToDec(delta.del));
              // draft.dms[ship].writs = draft.dms[ship].writs.delete(time);
            } else if ('add-feel' in delta) {
              /*  see above TODO
             * const d = delta['add-feel'];
            const time = bigInt(udToDec(d.time));
            const writ = draft.dms[ship].writs.get(time);
            writ.seal.feels[d.ship] = d.feel;
            draft.dms[ship].writs = draft.dms[ship].writs.set(time, writ);
            */
            }
            draft.writs[whom] = map;
          });
        },
      });
    },
  };
}
