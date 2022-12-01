import { BigIntOrderedMap, decToUd, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import {
  CurioSeal,
  HeapCurio,
  HeapCurios,
  HeapFlag,
  HeapUpdate,
} from '@/types/heap';
import api from '../../api';
import { HeapState } from './type';

interface CuriosStore {
  initialize: () => Promise<void>;
  getNewer: (count: string) => Promise<boolean>;
  getOlder: (count: string) => Promise<boolean>;
}

export default function makeCuriosStore(
  flag: HeapFlag,
  get: () => HeapState,
  scryPath: string,
  subPath: string
): CuriosStore {
  const scry = <T>(path: string) =>
    api.scry<T>({
      app: 'heap',
      path: `${scryPath}${path}`,
    });

  const getMessages = async (dir: 'older' | 'newer', count: string) => {
    const { curios } = get();
    let curioMap = curios[flag];

    const oldCuriosSize = curioMap.size ?? 0;
    if (oldCuriosSize === 0) {
      // already loading the graph
      return false;
    }

    const index =
      dir === 'newer'
        ? curioMap.peekLargest()?.[0]
        : curioMap.peekSmallest()?.[0];
    if (!index) {
      return false;
    }

    const fetchStart = decToUd(index.toString());

    const newCurios = await api.scry<HeapCurios>({
      app: 'heap',
      path: `${scryPath}/${dir}/${fetchStart}/${count}`,
    });

    get().batchSet((draft) => {
      Object.keys(newCurios).forEach((key) => {
        const curio = newCurios[key];
        const tim = bigInt(udToDec(key));
        curioMap = curioMap.set(tim, curio);
      });
      draft.curios[flag] = curioMap;
    });

    const newMessageSize = get().curios[flag].size;
    return dir === 'newer'
      ? newMessageSize !== oldCuriosSize
      : newMessageSize === oldCuriosSize;
  };

  return {
    initialize: async () => {
      const curios = await scry<HeapCurios>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}`
      );
      const sta = get();
      sta.batchSet((draft) => {
        let curioMap = new BigIntOrderedMap<HeapCurio>();

        Object.keys(curios).forEach((key) => {
          const curio = curios[key];
          const tim = bigInt(udToDec(key));
          curioMap = curioMap.set(tim, curio);
        });

        draft.curios[flag] = curioMap;
      });

      api.subscribe({
        app: 'heap',
        path: subPath,
        event: (data: HeapUpdate) => {
          const { time: addTime, diff } = data;

          if (!('curios' in diff)) {
            return;
          }

          const { time, delta } = diff.curios;
          const s = get();

          const addBigTime = bigInt(udToDec(addTime));
          const bigTime = bigInt(udToDec(time));
          s.batchSet((draft) => {
            let curioMap = draft.curios[flag];
            if ('add' in delta && !curioMap.has(addBigTime)) {
              const seal: CurioSeal = { time, feels: {}, replied: [] };
              const curio: HeapCurio = { seal, heart: delta.add };
              curioMap = curioMap.set(addBigTime, curio);
              if (delta.add.replying) {
                const replyTime = bigInt(udToDec(delta.add.replying));
                if (replyTime) {
                  const ancestor = curioMap.get(replyTime);
                  ancestor.seal.replied = [
                    ...ancestor.seal.replied,
                    udToDec(addTime),
                  ];
                  curioMap.set(replyTime, ancestor);
                }
              }
            } else if ('edit' in delta && curioMap.has(bigTime)) {
              const curio = curioMap.get(bigTime);
              curioMap = curioMap.set(bigTime, { ...curio, heart: delta.edit });
            } else if ('del' in delta && curioMap.has(bigTime)) {
              const old = curioMap.get(bigTime);
              curioMap = curioMap.delete(bigTime);
              if (old.heart.replying) {
                const replyTime = bigInt(udToDec(old.heart.replying));
                const ancestor = curioMap.get(replyTime);
                ancestor.seal.replied = ancestor.seal.replied.filter(
                  (r) => r !== old.heart.replying
                );
                curioMap.set(replyTime, ancestor);
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
            draft.curios[flag] = curioMap;
          });
        },
      });
    },
    getNewer: async (count: string) => getMessages('newer', count),
    getOlder: async (count: string) => getMessages('older', count),
  };
}
