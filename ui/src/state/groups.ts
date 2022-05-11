import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import produce from 'immer';
import { useParams } from 'react-router';
import { useCallback, useMemo } from 'react';
import {
  Gangs,
  Channel,
  Group,
  GroupDiff,
  Groups,
  GroupUpdate,
  GroupAction,
  Rank,
} from '../types/groups';
import api from '../api';

function groupAction(flag: string, diff: GroupDiff) {
  return {
    app: 'groups',
    mark: 'group-action',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  batchSet: (fn: (sta: GroupState) => void) => void;
  groups: {
    [flag: string]: Group;
  };
  gangs: Gangs;
  initialize: (flag: string) => Promise<number>;
  delRole: (flag: string, sect: string) => Promise<void>;
  banRanks: (flag: string, ranks: Rank[]) => Promise<void>;
  unbanRanks: (flag: string, ranks: Rank[]) => Promise<void>;
  addSects: (flag: string, ship: string, sects: string[]) => Promise<void>;
  addRole: (
    flag: string,
    sect: string,
    values: {
      title: string;
      description: string;
    }
  ) => Promise<void>;
  create: (req: {
    name: string;
    title: string;
    description: string;
  }) => Promise<void>;
  start: () => Promise<void>;
  search: (flag: string) => Promise<void>;
  join: (flag: string, joinAll: boolean) => Promise<void>;
}
export const useGroupState = create<GroupState>((set, get) => ({
  groups: {},
  gangs: {},
  banRanks: async (flag, ranks) => {
    await api.poke(
      groupAction(flag, {
        cordon: {
          open: {
            'add-ranks': ranks,
          },
        },
      })
    );
  },
  unbanRanks: async (flag, ranks) => {
    await api.poke(
      groupAction(flag, {
        cordon: {
          open: {
            'del-ranks': ranks,
          },
        },
      })
    );
  },
  search: async (flag) => {
    try {
      const res = await api.subscribeOnce('groups', `/gangs/${flag}/preview`);
      get().batchSet((draft) => {
        const gang = draft.gangs[flag] || {
          preview: null,
          invite: null,
          claim: null,
        };
        gang.preview = res;
        draft.gangs[flag] = gang;
      });
    } catch (e) {
      // TODO: fix error handling
      console.error(e);
    }
  },
  create: async (req) => {
    await api.poke({
      app: 'groups',
      mark: 'group-create',
      json: req,
    });
  },
  join: async (flag, joinAll) => {
    api.poke({
      app: 'groups',
      mark: 'group-join',
      json: {
        flag,
        'join-all': joinAll,
      },
    });
  },
  addSects: async (flag, ship, sects) => {
    const diff = {
      fleet: {
        ship,
        diff: {
          'add-sects': sects,
        },
      },
    };
    await api.poke(groupAction(flag, diff));
  },
  addRole: async (flag, sect, meta) => {
    const diff = {
      cabal: {
        sect,
        diff: {
          add: { ...meta, image: '' },
        },
      },
    };
    await api.poke(groupAction(flag, diff));
  },
  delRole: async (flag, sect) => {
    const diff = {
      cabal: {
        sect,
        diff: { del: null },
      },
    };
    await api.poke(groupAction(flag, diff));
  },
  start: async () => {
    const [groups, gangs] = await Promise.all([
      api.scry<Groups>({
        app: 'groups',
        path: '/groups',
      }),
      api.scry<Gangs>({
        app: 'groups',
        path: '/gangs',
      }),
    ]);
    set((s) => ({
      ...s,
      groups,
      gangs,
    }));
    await api.subscribe({
      app: 'groups',
      path: '/groups/ui',
      event: (data) => {
        const { flag, update } = data as GroupAction;
        if ('create' in update.diff) {
          const group = update.diff.create;
          get().batchSet((draft) => {
            draft.groups[flag] = group;
          });
        }
      },
    });
  },
  initialize: async (flag: string) =>
    api.subscribe({
      app: 'groups',
      path: `/groups/${flag}/ui`,
      event: (data: unknown) => {
        const { diff } = data as GroupUpdate;
        if ('channel' in diff) {
          const { flag: f, diff: d } = diff.channel;
          if ('add' in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f] = d.add;
            });
          } else if ('del' in d) {
            get().batchSet((draft) => {
              delete draft.groups[flag].channels[f];
            });
          }
        } else if ('fleet' in diff) {
          const { ship, diff: d } = diff.fleet;
          if ('add' in d) {
            get().batchSet((draft) => {
              draft.groups[flag].fleet[ship] = d.add;
            });
          } else if ('del' in d) {
            get().batchSet((draft) => {
              delete draft.groups[flag].fleet[ship];
            });
          } else if ('add-sects' in d) {
            get().batchSet((draft) => {
              const vessel = draft.groups[flag].fleet[ship];
              vessel.sects = [...vessel.sects, ...d['add-sects']];
            });
          } else if ('del-sects' in d) {
            get().batchSet((draft) => {
              const vessel = draft.groups[flag].fleet[ship];
              vessel.sects = vessel.sects.filter(
                (s) => !d['del-sects'].includes(s)
              );
            });
          }
        } else if ('cabal' in diff) {
          const { diff: d, sect } = diff.cabal;
          if ('add' in d) {
            get().batchSet((draft) => {
              draft.groups[flag].cabals[sect] = { meta: d.add };
            });
          } else if ('del' in d) {
            get().batchSet((draft) => {
              delete draft.groups[flag].cabals[sect];
            });
          }
        } else if ('cordon' in diff) {
          // console.log('todo');
        } else {
          // console.log('unreachable');
        }
      },
    }),
  set: (fn) => {
    set(produce(get(), fn));
  },
  batchSet: (fn) => {
    batchUpdates(() => {
      get().set(fn);
    });
  },
}));

export function useGroup(flag: string) {
  return useGroupState(useCallback((s) => s.groups[flag], [flag]));
}

export function useRouteGroup() {
  const { ship, name } = useParams();
  return useMemo(() => `${ship}/${name}`, [ship, name]);
}

const selList = (s: GroupState) => Object.keys(s.groups);
export function useGroupList() {
  return useGroupState(selList);
}

export function useVessel(flag: string, ship: string) {
  return useGroupState(
    useCallback((s) => s.groups[flag].fleet[ship], [ship, flag])
  );
}

const defGang = {
  invite: null,
  claim: null,
  preview: null,
};

export function useGang(flag: string) {
  return useGroupState(useCallback((s) => s.gangs[flag] || defGang, [flag]));
}

const selGangList = (s: GroupState) => Object.keys(s.gangs);
export function useGangList() {
  return useGroupState(selGangList);
}

export function useChannel(flag: string, channel: string): Channel | undefined {
  return useGroupState(
    useCallback((s) => s.groups[flag].channels[channel], [flag, channel])
  );
}
