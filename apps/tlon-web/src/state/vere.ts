import create, { SetState } from 'zustand';

import api from '@/api';

import useSchedulerStore, { useScheduler } from './scheduler';

interface Vere {
  cur: VereState;
  next?: VereState;
  set: SetState<Vere>;
  loaded: boolean;
  isLatest: boolean;
  vereVersion: string;
  latestVereVersion: string;
}

interface VereState {
  rev: string;
  non?: string;
  zuse?: number;
  arvo?: number;
  lull?: number;
  hoon?: number;
  nock?: number;
}

const useVereState = create<Vere>((set, get) => ({
  cur: {
    rev: '',
  },
  loaded: false,
  isLatest: true,
  vereVersion: '',
  latestVereVersion: '',
  set,
}));

const fetchRuntimeVersion = () => {
  api
    .thread({
      inputMark: 'noun',
      outputMark: 'vere-update',
      desk: 'base',
      threadName: 'runtime-version',
      body: '',
    })
    .then((data) => {
      useVereState.setState((state) => {
        if (typeof data === 'object' && data !== null) {
          const vereData = data as Vere;
          const vereVersion = vereData.cur.rev.split('/vere/~.')[1];
          const isLatest = vereData.next === undefined;
          const latestVereVersion =
            vereData.next !== undefined
              ? vereData.next.rev.split('/vere/~.')[1]
              : vereVersion;
          return Object.assign(vereData, {
            loaded: true,
            isLatest,
            vereVersion,
            latestVereVersion,
          });
        }
        return state;
      });
    })
    .catch((err) => {
      console.error(err);
    });
};

useSchedulerStore.getState().wait(fetchRuntimeVersion, 5);

setInterval(fetchRuntimeVersion, 1800000);

export default useVereState;

// window.vere = useVereState.getState;
