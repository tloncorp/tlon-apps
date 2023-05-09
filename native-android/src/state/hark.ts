import { create } from 'zustand';
import type { HarkAction, Rope, Yarn } from '../types/hark';
import useSubscriptionState from './subscription';
import useStore from './store';

export interface HarkState {
  fetchYarn: (uid: string) => Promise<Yarn>;
  sawRope: (rope: Rope, update?: boolean) => Promise<void>;
}

function harkAction(action: HarkAction) {
  return {
    app: 'hark',
    mark: 'hark-action',
    json: action,
  };
}

const useHarkState = create<HarkState>(() => ({
  fetchYarn: async (uid: string) => {
    const { api } = useStore.getState();
    if (!api) {
      throw new Error('No api found');
    }

    return api.scry<Yarn>({
      app: 'hark',
      path: `/yarn/${uid}`,
    });
  },
  sawRope: async (rope, update = true) => {
    const { api } = useStore.getState();
    if (api === null) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      api.poke({
        ...harkAction({
          'saw-rope': rope,
        }),
        onError: reject,
        onSuccess: async () => {
          if (!update) {
            resolve();
            return;
          }

          await useSubscriptionState
            .getState()
            .track('hark/ui', (event: HarkAction) => {
              return (
                'saw-rope' in event && event['saw-rope'].thread === rope.thread
              );
            });

          resolve();
        },
      });
    });
  },
}));

export default useHarkState;
