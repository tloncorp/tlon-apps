import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import produce, { current } from 'immer';
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
  GroupPreview,
  GroupMeta,
} from '../types/groups';
import api from '../api';

export const GROUP_ADMIN = 'admin';

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

function subscribeOnce<T>(app: string, path: string) {
  return new Promise<T>((resolve) => {
    api.subscribe({
      app,
      path,
      event: resolve,
    });
  });
}

interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  batchSet: (fn: (sta: GroupState) => void) => void;
  groups: {
    [flag: string]: Group;
  };
  pinnedGroups: string[];
  pinGroup: (flag: string) => Promise<void>;
  unpinGroup: (flag: string) => Promise<void>;
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
  createZone: (flag: string, zone: string, meta: GroupMeta) => Promise<void>;
  deleteZone: (flag: string, zone: string) => Promise<void>;
  addChannelToZone: (zone: string, groupFlag:string, channelFlag: string) => Promise<void>;
  removeChannelFromZone: (zone: string, groupFlag: string, channelFlag: string) => Promise<void>
  setChannelPerm: (flag: string, channelFlag: string, sects: string[]) => Promise<void>;
  setChannelJoin: (flag: string, channelFlag: string, join: boolean) => Promise<void>;
}

export const useGroupState = create<GroupState>((set, get) => ({
  groups: {},
  pinnedGroups: [],
  gangs: {},
  pinGroup: async (flag) => {
    await api.poke({
      app: 'groups',
      mark: 'group-remark-action',
      json: {
        flag,
        diff: { pinned: true },
      },
    });
  },
  unpinGroup: async (flag) => {
    await api.poke({
      app: 'groups',
      mark: 'group-remark-action',
      json: {
        flag,
        diff: { pinned: false },
      },
    });
  },
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
      const res = await subscribeOnce<GroupPreview>(
        'groups',
        `/gangs/${flag}/preview`
      );
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
          add: { ...meta, image: '', color: '' },
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
  createZone: async (flag, zone, meta) => {
    const diff = {
      zone: {
        zone,
        delta: {
          add: meta
        }
      }
    };
    await api.poke(groupAction(flag, diff));
  },
  deleteZone: async (flag, zone) => {
    const diff = {
      zone: {
        zone,
        delta: {
          del: null
        }
      }
    };
    await api.poke(groupAction(flag, diff));
  },
  addChannelToZone: async (zone, groupFlag, channelFlag) => {
    const diff = {
      channel: {
        flag: channelFlag,
        diff: {
          "add-zone": zone
        }     
      }
    };
    await api.poke(groupAction(groupFlag, diff));
  },
  removeChannelFromZone: async (zone, groupFlag, channelFlag) => {
    const diff = {
      channel: {
        flag: channelFlag,
        diff: {
          "del-zone": null,
        }
      }
    };
    await api.poke(groupAction(groupFlag, diff));
  },
  setChannelPerm: async (flag, channelFlag, sects) => {
    const currentReaders = get().groups[flag].channels[channelFlag]?.readers || [];
    const addDiff = {
      channel: {
        flag: channelFlag,
        diff: {
          "add-sects": sects.filter(s => !currentReaders.includes(s))
        }
      }
    };
    const removeDiff = {
      channel: {
        flag: channelFlag,
        diff: {
          "del-sects": currentReaders.filter(s => sects.includes(s))
        }
      }
    };
    await api.poke(groupAction(flag, addDiff));
    await api.poke(groupAction(flag, removeDiff));
  },
  setChannelJoin: async (flag, channelFlag, join) => {
    const diff = {
      channel: {
        flag: channelFlag,
        diff: {
          join
        }
      }
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
    try {
      const pinnedGroups = await api.scry<string[]>({
        app: 'groups',
        path: '/groups/pinned',
      });
      get().batchSet((draft) => {
        draft.pinnedGroups = pinnedGroups;
      });
    } catch (error) {
      console.log(error);
    }

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
          } else if ('add-zone' in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f].zone = d["add-zone"];
            });
          } else if ("del-zone" in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f].zone = null;
            });
          } else if ("add-sects" in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f].readers = [...draft.groups[flag].channels[f].readers, ...d['add-sects']];
            });
          } else if ("del-sects" in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f].readers = draft.groups[flag].channels[f].readers.filter((s) => !d['del-sects'].includes(s));
            });
          } else if ("join" in d) {
            get().batchSet((draft) => {
              draft.groups[flag].channels[f].join = d.join;
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

export function useGroup(flag: string): Group | undefined {
  return useGroupState(useCallback((s) => s.groups[flag], [flag]));
}

export function useRouteGroup() {
  const { ship, name } = useParams();
  return useMemo(() => `${ship}/${name}`, [ship, name]);
}

const selList = (s: GroupState) => Object.keys(s.groups);
export function useGroupList(): string[] {
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
    useCallback((s) => s.groups[flag]?.channels[channel], [flag, channel])
  );
}

export function usePinnedGroups() {
  return useGroupState(useCallback((s: GroupState) => s.pinnedGroups, []));
}

export function useAmAdmin(flag: string) {
  const group = useGroup(flag);
  const vessel = group?.fleet[window.our];
  return vessel && vessel.sects.includes(GROUP_ADMIN);
}
