import { create } from 'zustand';
import { HarkAction, Rope } from '../types/hark';
import useSubscriptionState from './subscription';
import useStore from './store';

export interface HarkState {
  /** start: fetches app-wide notifications and subscribes to updates */
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
