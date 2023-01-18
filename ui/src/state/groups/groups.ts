import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce from 'immer';
import { useParams } from 'react-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Gangs,
  GroupChannel,
  Group,
  GroupDiff,
  Groups,
  GroupAction,
  GroupPreview,
  GroupIndex,
  ChannelPreview,
  Cordon,
} from '@/types/groups';
import api from '@/api';
import asyncCallWithTimeout from '@/logic/asyncWithTimeout';
import {
  clearStorageMigration,
  createStorageKey,
  storageVersion,
} from '@/logic/utils';
import { BaitCite } from '@/types/chat';
import _ from 'lodash';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import groupsReducer from './groupsReducer';
import { GroupState } from './type';
import useSubscriptionState from '../subscription';

export const GROUP_ADMIN = 'admin';

function groupAction(flag: string, diff: GroupDiff) {
  return {
    app: 'groups',
    mark: 'group-action-0',
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

export const useGroupState = create<GroupState>(
  persist<GroupState>(
    (set, get) => ({
      initialized: false,
      channelPreviews: {},
      groups: {},
      gangs: {},
      shoal: {},
      fetchShoal: async (bait: BaitCite['bait']) => {
        let result: string | null = null;
        try {
          result = await subscribeOnce(
            'groups',
            `/bait/${bait.graph}/${bait.group}`
          );
        } catch (e) {
          console.log(e);
        }
        get().batchSet((draft) => {
          draft.shoal[bait.graph] = result;
        });
        return result;
      },
      banShips: async (flag, ships) => {
        await api.poke(
          groupAction(flag, {
            cordon: {
              open: {
                'add-ships': ships,
              },
            },
          })
        );
      },
      unbanShips: async (flag, ships) => {
        await api.poke(
          groupAction(flag, {
            cordon: {
              open: {
                'del-ships': ships,
              },
            },
          })
        );
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
      index: async (ship) => {
        try {
          const res = await subscribeOnce<GroupIndex>(
            'groups',
            `/gangs/index/${ship}`
          );
          if (res) {
            return res;
          }
          return {};
        } catch (e) {
          // TODO: fix error handling
          console.error(e);
          return {};
        }
      },
      search: async (flag) => {
        try {
          const res = await subscribeOnce<GroupPreview>(
            'groups',
            `/gangs/${flag}/preview`
          );
          if (res) {
            get().batchSet((draft) => {
              const gang = draft.gangs[flag] || {
                preview: null,
                invite: null,
                claim: null,
              };
              gang.preview = res;
              draft.gangs[flag] = gang;
            });
          }
        } catch (e) {
          // TODO: fix error handling
          console.error(e);
        }
      },
      channelPreview: async (nest) => {
        try {
          const res = await subscribeOnce<ChannelPreview>(
            'groups',
            `/chan/${nest}`
          );
          if (res) {
            get().batchSet((draft) => {
              draft.channelPreviews[nest] = res;
            });
          }
        } catch (e) {
          // TODO: fix error handling
          console.error(e);
        }
      },
      edit: async (flag, metadata) =>
        new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, { meta: metadata }),
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { diff } = event.update;
                    return (
                      'meta' in diff &&
                      diff.meta.title === metadata.title &&
                      event.flag === flag
                    );
                  }

                  return false;
                });

              resolve();
            },
          });
        }),
      create: async (req) =>
        new Promise((resolve, reject) => {
          api.poke({
            app: 'groups',
            mark: 'group-create',
            json: req,
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { update } = event as GroupAction;
                    return (
                      'create' in update.diff &&
                      req.title === update.diff.create.meta.title
                    );
                  }

                  return false;
                });

              resolve();
            },
          });
        }),
      delete: async (flag) =>
        new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, { del: null }),
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { diff } = event.update;
                    return 'del' in diff && event.flag === flag;
                  }

                  return false;
                });

              resolve();
            },
          });
        }),
      join: async (flag, joinAll) => {
        get().batchSet((draft) => {
          draft.gangs[flag].invite = null;
          draft.gangs[flag].claim = {
            progress: 'adding',
            'join-all': joinAll,
          };
        });

        await new Promise<void>((resolve, reject) => {
          api.poke({
            app: 'groups',
            mark: 'group-join',
            json: {
              flag,
              'join-all': joinAll,
            },
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if (typeof event === 'object' && 'flag' in event) {
                    return flag === event.flag;
                  }

                  return false;
                });

              resolve();
            },
          });
        });
      },
      knock: async (flag) => {
        api.poke({
          app: 'groups',
          mark: 'group-knock',
          json: flag,
        });
      },
      rescind: async (flag) => {
        api.poke({
          app: 'groups',
          mark: 'group-rescind',
          json: flag,
        });
      },
      invite: async (flag, ships) => {
        await api.poke(
          groupAction(flag, {
            cordon: {
              shut: {
                'add-ships': {
                  kind: 'pending',
                  ships,
                },
              },
            },
          })
        );

        const groups = await api.scry<Groups>({
          app: 'groups',
          path: '/groups',
        });
        set(() => ({ groups }));
      },
      revoke: async (flag, ships, kind) => {
        api.poke(
          groupAction(flag, {
            cordon: {
              shut: {
                'del-ships': {
                  kind,
                  ships,
                },
              },
            },
          })
        );
      },
      reject: async (flag) => {
        await api.poke({
          app: 'groups',
          mark: 'invite-decline',
          json: flag,
        });

        get().batchSet((draft) => {
          draft.gangs[flag].invite = null;
        });
      },
      cancel: async (flag) => {
        await api.poke({
          app: 'groups',
          mark: 'group-cancel',
          json: flag,
        });

        get().batchSet((draft) => {
          draft.gangs[flag].claim = null;
        });
      },
      leave: async (flag: string) => {
        await api.poke({
          app: 'groups',
          mark: 'group-leave',
          json: flag,
        });
      },
      swapCordon: async (flag: string, cordon: Cordon) => {
        await api.poke(
          groupAction(flag, {
            cordon: {
              swap: cordon,
            },
          })
        );
      },
      setSecret: async (flag: string, isSecret: boolean) => {
        await api.poke(groupAction(flag, { secret: isSecret }));
      },
      addSects: async (flag, ship, sects) => {
        const dif = {
          fleet: {
            ships: [ship],
            diff: {
              'add-sects': sects,
            },
          },
        };
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, dif),
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { diff } = event.update;
                    return (
                      'fleet' in diff &&
                      'diff' in diff.fleet &&
                      'add-sects' in diff.fleet.diff &&
                      diff.fleet.ships.includes(ship) &&
                      event.flag === flag
                    );
                  }

                  return false;
                });

              resolve();
            },
          });
        });
      },
      delSects: async (flag, ship, sects) => {
        const dif = {
          fleet: {
            ships: [ship],
            diff: {
              'del-sects': sects,
            },
          },
        };
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, dif),
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { diff } = event.update;
                    return (
                      'fleet' in diff &&
                      'diff' in diff.fleet &&
                      'del-sects' in diff.fleet.diff &&
                      diff.fleet.ships.includes(ship) &&
                      event.flag === flag
                    );
                  }

                  return false;
                });

              resolve();
            },
          });
        });
      },
      addMembers: async (flag, ships) => {
        const diff = {
          fleet: {
            ships,
            diff: {
              add: null,
            },
          },
        };
        await api.poke(groupAction(flag, diff));
      },
      delMembers: async (flag, ships) => {
        const diff = {
          fleet: {
            ships,
            diff: {
              del: null,
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
              add: { ...meta, image: '', cover: '' },
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
      editChannel: async (flag, nest, channel) => {
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, {
              channel: {
                nest,
                diff: {
                  edit: channel,
                },
              },
            }),
            onError: () => reject(),
            onSuccess: async () => {
              useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { update } = event as GroupAction;
                    return (
                      'channel' in update.diff &&
                      nest === update.diff.channel.nest &&
                      'add' in update.diff.channel.diff
                    );
                  }

                  return false;
                });
              resolve();
            },
          });
        });
      },
      deleteChannel: async (flag, nest) => {
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, {
              channel: {
                nest,
                diff: {
                  del: null,
                },
              },
            }),
            onError: () => reject(),
            onSuccess: async () => {
              useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { update } = event as GroupAction;
                    return (
                      'channel' in update.diff &&
                      nest === update.diff.channel.nest &&
                      'del' in update.diff.channel.diff
                    );
                  }

                  return false;
                });
              resolve();
            },
          });
        });
      },
      createZone: async (flag, zone, meta) => {
        const dif = {
          zone: {
            zone,
            delta: {
              add: meta,
            },
          },
        };
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, dif),
            onError: () => reject(),
            onSuccess: async () => {
              useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { update } = event as GroupAction;
                    return (
                      'zone' in update.diff &&
                      zone === update.diff.zone.zone &&
                      'add' in update.diff.zone.delta
                    );
                  }

                  return false;
                });
              resolve();
            },
          });
        });
      },
      editZone: async (flag, zone, meta) => {
        const diff = {
          zone: {
            zone,
            delta: {
              edit: meta,
            },
          },
        };
        await api.poke(groupAction(flag, diff));
      },
      moveZone: async (flag, zone, index) => {
        const diff = {
          zone: {
            zone,
            delta: {
              mov: index,
            },
          },
        };
        await api.poke(groupAction(flag, diff));
      },
      deleteZone: async (flag, zone) => {
        const diff = {
          zone: {
            zone,
            delta: {
              del: null,
            },
          },
        };
        await api.poke(groupAction(flag, diff));
      },
      addChannelToZone: async (zone, flag, nest) => {
        const dif = {
          channel: {
            nest,
            diff: {
              zone,
            },
          },
        };
        await new Promise<void>((resolve, reject) => {
          api.poke({
            ...groupAction(flag, dif),
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('groups/groups/ui', (event) => {
                  if ('update' in event) {
                    const { diff } = event.update;
                    if ('channel' in diff) {
                      const { nest: channelNest, diff: channelDiff } =
                        diff.channel;
                      if (channelNest === nest && 'zone' in channelDiff) {
                        return true;
                      }
                    }
                  }

                  return false;
                });

              resolve();
            },
          });
        });
      },
      moveChannel: async (flag, zone, nest, index) => {
        const diff = {
          zone: {
            zone,
            delta: {
              'mov-nest': {
                nest,
                index,
              },
            },
          },
        };
        await api.poke(groupAction(flag, diff));
        await useGroupState.getState().updateGroups();
      },
      setChannelPerm: async (flag, nest, sects) => {
        const currentReaders = get().groups[flag].channels[nest]?.readers || [];
        const addDiff = {
          channel: {
            nest,
            diff: {
              'add-sects': sects.filter((s) => !currentReaders.includes(s)),
            },
          },
        };
        const removeDiff = {
          channel: {
            nest,
            diff: {
              'del-sects': currentReaders.filter((s) => sects.includes(s)),
            },
          },
        };
        await api.poke(groupAction(flag, addDiff));
        await api.poke(groupAction(flag, removeDiff));
      },
      setChannelJoin: async (flag, nest, join) => {
        const diff = {
          channel: {
            nest,
            diff: {
              join,
            },
          },
        };
        await api.poke(groupAction(flag, diff));
      },
      updateGroups: async () => {
        const groups = await api.scry<Groups>({
          app: 'groups',
          path: '/groups',
        });
        set(() => ({ groups }));
      },
      start: async () => {
        const [groups, gangs] = await Promise.all([
          api.scry<Groups>({
            app: 'groups',
            path: '/groups/light',
          }),
          api.scry<Gangs>({
            app: 'groups',
            path: '/gangs',
          }),
        ]);

        set((s) => ({
          ...s,
          groups: _.merge(groups, s.groups),
          gangs,
        }));
        await api.subscribe({
          app: 'groups',
          path: '/gangs/updates',
          event: (data) => {
            get().batchSet((draft) => {
              draft.gangs = data;
            });
          },
        });
        await api.subscribe({
          app: 'groups',
          path: '/groups/ui',
          event: (data, mark) => {
            if (mark === 'gang-gone') {
              get().batchSet((draft) => {
                delete draft.gangs[data];
              });
            }

            const { flag, update } = data as GroupAction;
            if (update) {
              // check if update exists, sometimes we just get back the flag.
              // TODO: figure out why this happens
              if ('create' in update.diff) {
                const group = update.diff.create;
                get().batchSet((draft) => {
                  draft.groups[flag] = group;
                });
              }

              if ('del' in update.diff) {
                get().batchSet((draft) => {
                  delete draft.groups[flag];
                });
              }
            }
          },
        });

        get().batchSet((draft) => {
          draft.initialized = true;
        });
      },
      initialize: async (flag: string) => {
        const group = await api.scry<Group>({
          app: 'groups',
          path: `/groups/${flag}`,
        });

        get().batchSet((draft) => {
          draft.groups[flag] = group;
        });

        return api.subscribe({
          app: 'groups',
          path: `/groups/${flag}/ui`,
          event: (data) => get().batchSet(groupsReducer(flag, data)),
        });
      },
      set: (fn) => {
        set(produce(get(), fn));
      },
      batchSet: (fn) => {
        batchUpdates(() => {
          get().set(fn);
        });
      },
    }),
    {
      name: createStorageKey('groups'),
      version: storageVersion,
      migrate: clearStorageMigration,
      merge: (persisted, current) => _.merge(current, persisted),
      partialize: (state) => {
        const groups = _.mapValues(state.groups, ({ fleet, ...group }) => ({
          ...group,
          fleet: {},
        }));
        return {
          groups,
        };
      },
    }
  )
);

const selGroups = (s: GroupState) => s.groups;
export function useGroups(): Groups {
  return useGroupState(selGroups);
}

export function useGroup(flag: string): Group | undefined {
  return useGroupState(useCallback((s) => s.groups[flag], [flag]));
}

export function useRouteGroup() {
  const { ship, name } = useParams();
  return useMemo(() => {
    if (!ship || !name) {
      return '';
    }

    return `${ship}/${name}`;
  }, [ship, name]);
}

/**
 * Alias for useRouteGroup
 * @returns group flag - a string
 */
export function useGroupFlag() {
  return useRouteGroup();
}

const selList = (s: GroupState) => Object.keys(s.groups);
export function useGroupList(): string[] {
  return useGroupState(selList);
}

export function useVessel(flag: string, ship: string) {
  return useGroupState(
    useCallback(
      (s) =>
        s.groups[flag]?.fleet[ship] || {
          sects: [],
          joined: 0,
        },
      [ship, flag]
    )
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

const selGangs = (s: GroupState) => s.gangs;
export function useGangs() {
  return useGroupState(selGangs);
}

const selGangList = (s: GroupState) => Object.keys(s.gangs);
export function useGangList() {
  return useGroupState(selGangList);
}

export function useChannel(
  flag: string,
  channel: string
): GroupChannel | undefined {
  return useGroupState(
    useCallback((s) => s.groups[flag]?.channels[channel], [flag, channel])
  );
}

export function useAmAdmin(flag: string) {
  const group = useGroup(flag);
  const vessel = group?.fleet[window.our];
  return vessel && vessel.sects.includes(GROUP_ADMIN);
}

export function usePendingInvites() {
  const groups = useGroups();
  const gangs = useGangs();
  return useMemo(
    () =>
      Object.entries(gangs)
        .filter(([k, g]) => g.invite !== null && !(k in groups))
        .map(([k]) => k),
    [gangs, groups]
  );
}

export function usePendingGangs() {
  const groups = useGroups();
  const gangs = useGangs();
  const pendingGangs: Gangs = {};

  Object.entries(gangs)
    .filter(([flag, g]) => g.invite !== null && !(flag in groups))
    .forEach(([flag, gang]) => {
      pendingGangs[flag] = gang;
    });

  return pendingGangs;
}

export function usePendingGangsWithoutClaim() {
  const groups = useGroups();
  const gangs = useGangs();
  const pendingGangs: Gangs = {};

  Object.entries(gangs)
    .filter(([flag, g]) => g.invite !== null && !(flag in groups))
    .filter(
      ([, gang]) =>
        !gang.claim ||
        gang.claim.progress === 'error' ||
        gang.claim.progress === 'knocking'
    )
    .forEach(([flag, gang]) => {
      pendingGangs[flag] = gang;
    });

  return pendingGangs;
}

const selInit = (s: GroupState) => s.initialized;
export function useGroupsInitialized() {
  return useGroupState(selInit);
}

export function useSects(flag: string) {
  const group = useGroup(flag);
  return group ? Object.keys(group.cabals) : [];
}

const { shouldLoad, newAttempt, finished } = getPreviewTracker();

export function useChannelPreview(nest: string) {
  const preview = useGroupState(
    useCallback((s) => s.channelPreviews[nest], [nest])
  );

  const getChannelPreview = useCallback(async () => {
    asyncCallWithTimeout(
      useGroupState.getState().channelPreview(nest),
      10 * 1000
    ).finally(() => finished(nest));
  }, [nest]);

  useEffect(() => {
    if (preview && !shouldLoad(nest)) return;

    newAttempt(nest);
    getChannelPreview();
  }, [getChannelPreview, preview, nest]);

  return preview;
}

export function useShoal(bait: BaitCite['bait']) {
  const res = useGroupState(
    useCallback(
      (s) => s.shoal[bait.graph] as string | null | undefined,
      [bait.graph]
    )
  );

  useEffect(() => {
    if (_.isUndefined(res)) {
      useGroupState.getState().fetchShoal(bait);
    }
  }, [bait, res]);

  return res;
}

(window as any).groups = useGroupState.getState;
