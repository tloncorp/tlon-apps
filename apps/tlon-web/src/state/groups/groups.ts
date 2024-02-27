import {
  MutationFunction,
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { decToUd } from '@urbit/api';
import { Poke } from '@urbit/http-api';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import create from 'zustand';

import api from '@/api';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import {
  getCompatibilityText,
  getFlagParts,
  preSig,
  sagaCompatible,
} from '@/logic/utils';
import { BaitCite, Post, Reply } from '@/types/channel';
import {
  ChannelPreview,
  Cordon,
  Gang,
  Gangs,
  Group,
  GroupAction,
  GroupChannel,
  GroupCreate,
  GroupDiff,
  GroupIndex,
  GroupJoin,
  GroupMeta,
  GroupPreview,
  Groups,
  PrivacyType,
  Vessel,
  isGroup,
} from '@/types/groups';
import { Scope, VolumeValue } from '@/types/volume';

import { useGroupPins } from '../pins';
import { useNewGroupFlags } from '../settings';

export const GROUP_ADMIN = 'admin';

export const GROUPS_KEY = 'groups';

function groupAction(flag: string, diff: GroupDiff): Poke<GroupAction> {
  return {
    app: 'groups',
    mark: 'group-action-3',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function defaultValidator(data: GroupAction) {
  return (event: GroupAction): boolean => {
    return (
      data.flag === event.flag && _.isEqual(data.update.diff, event.update.diff)
    );
  };
}

function groupTrackedPoke(action: Poke<GroupAction>) {
  return api.trackedPoke<GroupAction>(
    action,
    { app: 'groups', path: '/groups/ui' },
    defaultValidator(action.json)
  );
}

export const useGroupConnectionState = create<{
  groups: Record<string, boolean>;
  setGroupConnected: (group: string, connected: boolean) => void;
}>((set) => ({
  groups: {},
  setGroupConnected: (group, connected) =>
    set((state) => ({
      groups: {
        ...state.groups,
        [group]: connected,
      },
    })),
}));

export function useGroupConnection(flag: string) {
  return useGroupConnectionState((state) => state.groups[flag] ?? true);
}

const emptyGroups: Groups = {};
export function useGroupsWithQuery() {
  const { data, ...rest } = useReactQuerySubscription<Groups>({
    queryKey: [GROUPS_KEY],
    app: 'groups',
    path: `/groups/ui`,
    scry: `/groups/light/v1`,
    options: {
      refetchOnReconnect: false, // handled in bootstrap reconnect flow
    },
  });

  const stringifiedRest = JSON.stringify(rest);

  return useMemo(() => {
    if (rest.isLoading || rest.isError || !data) {
      return { data: emptyGroups, ...rest };
    }

    return {
      data,
      ...rest,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, stringifiedRest, rest.isLoading, rest.isError]);
}

export function useGroups() {
  const { data, ...rest } = useReactQuerySubscription<Groups>({
    queryKey: [GROUPS_KEY],
    app: 'groups',
    path: `/groups/ui`,
    scry: `/groups/light/v1`,
    options: {
      refetchOnReconnect: false, // handled in bootstrap reconnect flow
    },
  });

  if (!data || rest.isLoading || rest.isError) {
    return emptyGroups;
  }

  return data;
}

export function useGroup(flag: string, updating = false): Group | undefined {
  const connection = useGroupConnection(flag);
  const queryClient = useQueryClient();
  const initialData = useGroups();
  const group = initialData?.[flag];
  const queryKey = useMemo(() => [GROUPS_KEY, flag], [flag]);
  const subscribe = useCallback(() => {
    api.subscribe({
      app: 'groups',
      path: `/groups/${flag}/ui`,
      event: _.debounce(
        () => {
          queryClient.invalidateQueries(queryKey);
        },
        300,
        { leading: true, trailing: true }
      ),
    });
  }, [flag, queryKey, queryClient]);

  const { data, ...rest } = useReactQueryScry<Group>({
    queryKey,
    app: 'groups',
    path: `/groups/${flag}/v1`,
    options: {
      enabled: !!flag && flag !== '' && updating && connection,
      placeholderData: group,
      refetchOnMount: updating,
      retry: true,
      // prevents skeleton from flashing on unmount when we have cached data
      keepPreviousData: true,
    },
  });

  useEffect(() => {
    if (updating && flag) {
      subscribe();
    }
  }, [flag, updating, subscribe]);

  if (rest.isLoading || rest.isError || data === undefined) {
    return undefined;
  }

  return data;
}

export function useGroupIsLoading(flag: string) {
  return useQueryClient().getQueryState([GROUPS_KEY, flag]);
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

export function useGroupName() {
  const { name } = useParams();
  return useMemo(() => {
    if (!name) {
      return '';
    }

    return name;
  }, [name]);
}

export function useGroupShip() {
  const { ship } = useParams();
  return useMemo(() => {
    if (!ship) {
      return '';
    }

    return ship;
  }, [ship]);
}

/**
 * Alias for useRouteGroup
 * @returns group flag - a string
 */
export function useGroupFlag() {
  return useRouteGroup();
}

export function useGroupList(): string[] {
  const data = useGroups();

  return Object.keys(data || {});
}

export function useVessel(flag: string, ship: string): Vessel {
  const data = useGroup(flag);

  return (
    data?.fleet?.[ship] || {
      sects: [],
      joined: 0,
    }
  );
}

const defGang = {
  invite: null,
  claim: null,
  preview: null,
};

export function useGangs() {
  const queryClient = useQueryClient();
  const queryKey = ['gangs'];

  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries(queryKey);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const { data, ...rest } = useReactQuerySubscription({
    queryKey,
    app: 'groups',
    path: `/gangs/updates`,
    scry: `/gangs`,
    onEvent: (event) => {
      // right now for long group joins, the gang is initially removed but no fact about the corresponding created
      // group is emitted until the join completes. This is a blunt hack to ensure our view of existing groups remains up to date.
      // Once this is fixed, we should remove this and use the default useReactQuerySubscription event handler
      const currGangCount = Object.keys(
        queryClient.getQueryData<Gangs>(queryKey) || {}
      ).length;
      const newGangCount = Object.keys(event || {}).length;
      const gangWasRemoved =
        currGangCount && newGangCount && newGangCount < currGangCount;
      if (gangWasRemoved) {
        queryClient.invalidateQueries(['groups']);
      }

      invalidate.current();
    },
    options: {
      refetchOnMount: false,
    },
  });

  // this is a bit of a hack to get the group index data into the gangs
  const groupIndexDataAsGangs: Gangs = useMemo(
    () =>
      (queryClient.getQueriesData(['group-index']) || []).reduce(
        (acc, [_queryKey, indexData]) => {
          if (indexData && typeof indexData === 'object') {
            const newAcc = { ...acc };
            Object.keys(indexData).forEach((key) => {
              (newAcc as Gangs)[key] = {
                preview: (indexData as GroupIndex)[key],
                invite: null,
                claim: null,
              };
            });
            return newAcc;
          }
          return acc;
        },
        {}
      ),
    [queryClient]
  );

  return useMemo(() => {
    if (rest.isLoading || rest.isError) {
      return {} as Gangs;
    }

    return {
      ...groupIndexDataAsGangs,
      ...(data as Gangs),
    };
  }, [data, groupIndexDataAsGangs, rest.isLoading, rest.isError]);
}

export function useGang(flag: string) {
  const data = useGangs();

  return data?.[flag] || defGang;
}

export const useGangPreview = (
  flag: string,
  disabled = false
): GroupPreview | null => {
  const gangs = useGangs();

  const { data, ...rest } = useReactQuerySubscribeOnce<GroupPreview>({
    queryKey: ['gang-preview', flag],
    app: 'groups',
    path: `/gangs/${flag}/preview`,
    options: {
      enabled: !disabled,
      initialData: gangs[flag]?.preview || undefined,
    },
  });

  if (rest.isLoading || rest.isError) {
    return null;
  }

  return data as GroupPreview;
};

export function useGangList() {
  const data = useGangs();
  return useMemo(() => Object.keys(data || {}), [data]);
}

export function useGroupChannel(
  flag: string,
  channel: string
): GroupChannel | undefined {
  const data = useGroup(flag);

  return data?.channels?.[channel];
}

export function useChannelList(flag: string): string[] {
  const data = useGroup(flag);

  return Object.keys(data?.channels || {});
}

export function useAmAdmin(flag: string) {
  const group = useGroup(flag);
  const vessel = group?.fleet?.[window.our];
  return vessel && vessel.sects.includes(GROUP_ADMIN);
}

export function usePendingInvites() {
  const groups = useGroups();
  const gangs = useGangs();
  return useMemo(
    () =>
      Object.entries(gangs)
        .filter(([k, g]) => g.invite && g.invite !== null && !(k in groups))
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

export function usePinnedGroups(): Groups {
  const pins = useGroupPins();
  const groups = useGroups();

  return pins.reduce(
    (acc, pin) => ({ ...acc, [pin]: groups[pin] }),
    {} as Groups
  );
}

export function usePendingGangsWithoutClaim() {
  const groups = useGroups();
  const gangs = useGangs();
  const pendingGangs: Gangs = {};

  Object.entries(gangs)
    .filter(([flag, g]) => g.invite && g.invite !== null && !(flag in groups))
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

export function useGangsWithClaim() {
  const data = useGangs();
  const withClaim = useMemo(
    () => Object.entries(data).filter(([flag, group]) => !!group.claim),
    [data]
  );
  return useMemo(() => withClaim.map(([flag, gang]) => flag), [withClaim]);
}

// this state occurs when the group has successfully joined on the
// host, but has not yet received initial metadata & channel info
export function groupIsInitializing(group: Group) {
  return !group.meta || group.meta.title === '';
}

export function gangIsJoining(gang: Gang) {
  return gang.claim && gang.claim.progress === 'adding';
}

export function useGroupJoinInProgress(flag: string) {
  const group = useGroup(flag);
  const gang = useGang(flag);

  return (group && groupIsInitializing(group)) || (gang && gangIsJoining(gang));
}

export function useLoadingGroups() {
  const groups = useGroups();
  const gangs = useGangs();
  return Object.entries(groups).filter(([flag, group]) => {
    return (
      (group && groupIsInitializing(group)) ||
      (gangs[flag] && gangs[flag].preview && gangIsJoining(gangs[flag]))
    );
  });
}

export function useNewGroups() {
  const groups = useGroups();
  const newGroupFlags = useNewGroupFlags();

  return Object.entries(groups).filter(([flag]) => {
    return newGroupFlags.includes(flag);
  });
}

export function useSects(flag: string) {
  const group = useGroup(flag);
  return group ? Object.keys(group.cabals) : [];
}

export function useChannelPreview(nest: string, disableLoading = false) {
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: ['channel-preview', nest],
    app: 'groups',
    path: `/chan/${nest}`,
    options: {
      enabled: !disableLoading,
      refetchOnMount: false,
    },
  });

  if (rest.isLoading || rest.isError) {
    return null;
  }

  return data as ChannelPreview;
}

export function useShoal(bait: BaitCite['bait']) {
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: ['shoal', bait.graph],
    app: 'groups',
    path: `/bait/${bait.graph}/${bait.group}`,
  });

  if (rest.isLoading || rest.isError) {
    return null;
  }

  return data;
}

export function useVolume(scope?: Scope): {
  volume: VolumeValue;
  isLoading: boolean;
  isError: boolean;
} {
  const nestOrFlag = scope
    ? 'group' in scope
      ? scope.group
      : scope.channel
    : undefined;

  const { data, ...rest } = useReactQueryScry({
    queryKey: ['volume', nestOrFlag ?? 'base'],
    app: 'groups',
    path: `/volume${nestOrFlag ? `/${nestOrFlag}` : ''}`,
    options: {
      refetchOnMount: false,
    },
  });

  return {
    volume: data as VolumeValue,
    isLoading: rest.isLoading,
    isError: rest.isError,
  };
}

export function useGroupMutation<TResponse>(
  mutationFn: MutationFunction<TResponse, any>,
  options?: UseMutationOptions<TResponse, unknown, any, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([GROUPS_KEY, variables.flag]);

      const data = await queryClient.getQueryData([GROUPS_KEY, variables.flag]);
      const previousGroup = data as Group;

      const { zone, nest, idx, meta, index, metadata } = variables;

      if (metadata) {
        // edit group metadata
        queryClient.setQueryData([GROUPS_KEY, variables.flag], {
          ...previousGroup,
          meta: {
            ...previousGroup.meta,
            ...metadata,
          },
        });
      }

      if (zone) {
        const previousZone = (previousGroup as Group)?.zones[zone];

        if (previousZone) {
          if (index !== undefined) {
            // move a zone
            const newZoneOrd = previousGroup['zone-ord'].filter(
              (z) => z !== zone
            );
            newZoneOrd.splice(index, 0, zone);
            queryClient.setQueryData([GROUPS_KEY, variables.flag], {
              ...previousGroup,
              'zone-ord': newZoneOrd,
            });
          }

          if (meta) {
            // edit zone metadata
            queryClient.setQueryData([GROUPS_KEY, variables.flag], {
              ...previousGroup,
              zones: {
                ...previousGroup.zones,
                [zone]: {
                  ...previousZone,
                  meta: {
                    ...previousZone.meta,
                    ...meta,
                  },
                },
              },
            });
          }

          if (idx !== undefined && nest) {
            // move a channel within a zone
            const newIdxArray = previousZone.idx.filter((n) => n !== nest);
            newIdxArray.splice(idx, 0, nest);

            queryClient.setQueryData([GROUPS_KEY, variables.flag], {
              ...previousGroup,
              zones: {
                ...previousGroup.zones,
                [zone]: {
                  ...previousZone,
                  idx: newIdxArray,
                },
              },
            });
          }
        }
        if (zone && !previousZone && meta) {
          // add a new zone
          const newZoneOrd = previousGroup['zone-ord'];
          newZoneOrd.splice(1, 0, zone);
          queryClient.setQueryData([GROUPS_KEY, variables.flag], {
            ...previousGroup,
            zones: {
              ...previousGroup.zones,
              [zone]: {
                idx: [],
                meta,
              },
            },
            'zone-ord': newZoneOrd,
          });
        }
      }

      return data;
    },
    onError: (err, variables, previousGroup) => {
      queryClient.setQueryData([GROUPS_KEY, variables.flag], previousGroup);
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries([GROUPS_KEY, variables.flag]),
    ...options,
  });
}

export function useEditChannelMutation() {
  const mutationFn = (variables: {
    flag: string;
    nest: string;
    channel: GroupChannel;
  }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        channel: {
          nest: variables.nest,
          diff: {
            edit: variables.channel,
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useDeleteChannelMutation() {
  const mutationFn = (variables: { flag: string; nest: string }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        channel: {
          nest: variables.nest,
          diff: {
            del: null,
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useAddChannelMutation() {
  const mutationFn = (variables: {
    flag: string;
    zone: string;
    nest: string;
  }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        channel: {
          nest: variables.nest,
          diff: {
            zone: variables.zone,
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupCreateZoneMutation() {
  const mutationFn = async (variables: {
    flag: string;
    zone: string;
    meta: GroupMeta;
  }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        zone: {
          zone: variables.zone,
          delta: {
            add: variables.meta,
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupEditZoneMutation() {
  const mutationFn = async (variables: {
    flag: string;
    zone: string;
    meta: GroupMeta;
  }) => {
    const diff = {
      zone: {
        zone: variables.zone,
        delta: {
          edit: variables.meta,
        },
      },
    };

    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupMoveZoneMutation() {
  const mutationFn = async (variables: {
    flag: string;
    zone: string;
    index: number;
  }) => {
    const diff = {
      zone: {
        zone: variables.zone,
        delta: {
          mov: variables.index,
        },
      },
    };

    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupDeleteZoneMutation() {
  const mutationFn = async (variables: { flag: string; zone: string }) => {
    const diff = {
      zone: {
        zone: variables.zone,
        delta: {
          del: null,
        },
      },
    };

    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupMoveChannelMutation() {
  const mutationFn = async (variables: {
    flag: string;
    nest: string;
    idx: number;
    zone: string;
  }) => {
    const diff = {
      zone: {
        zone: variables.zone,
        delta: {
          'mov-nest': {
            nest: variables.nest,
            idx: variables.idx,
          },
        },
      },
    };

    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useEditGroupMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: { flag: string; metadata: GroupMeta }) =>
    api.trackedPoke(
      groupAction(variables.flag, { meta: variables.metadata }),
      {
        app: 'groups',
        path: '/groups/ui',
      },
      (event) => {
        return (
          event.flag === variables.flag &&
          'meta' in event.update.diff &&
          _.isEqual(event.update.diff.meta, variables.metadata)
        );
      }
    );

  return useGroupMutation(mutationFn, options);
}

export function useCreateGroupMutation() {
  const mutationFn = (variables: GroupCreate) =>
    api.trackedPoke<GroupCreate, GroupAction>(
      {
        app: 'groups',
        mark: 'group-create',
        json: variables,
      },
      { app: 'groups', path: '/groups/ui' },
      (event) => {
        if (!('update' in event)) {
          return false;
        }

        const { update } = event;
        return (
          'create' in update.diff &&
          variables.title === update.diff.create.meta.title
        );
      }
    );

  return useMutation(mutationFn);
}

export function useDeleteGroupMutation() {
  const mutationFn = (variables: { flag: string }) =>
    groupTrackedPoke(groupAction(variables.flag, { del: null }));

  return useGroupMutation(mutationFn);
}

export function useGroupJoinMutation() {
  const queryClient = useQueryClient();

  const mutationFn = (variables: { flag: string; privacy: PrivacyType }) =>
    api.trackedPoke<GroupJoin, GroupAction>(
      {
        app: 'groups',
        mark: 'group-join',
        json: {
          flag: variables.flag,
          'join-all': true,
        },
      },
      { app: 'groups', path: '/groups/ui' },
      (event) => {
        if (typeof event === 'object' && 'flag' in event) {
          return variables.flag === event.flag;
        }

        return false;
      }
    );

  return useGroupMutation(mutationFn, {
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['gangs']);
      queryClient.invalidateQueries(['gangs', variables.flag]);
      queryClient.invalidateQueries([GROUPS_KEY]);

      captureGroupsAnalyticsEvent({
        name: 'group_join',
        groupFlag: variables.flag,
        privacy: variables.privacy,
      });
    },
  });
}

export function useGroupLeaveMutation() {
  const queryClient = useQueryClient();
  return useGroupMutation(
    async (variables: { flag: string; privacy: PrivacyType }) => {
      await api.poke({
        app: 'groups',
        mark: 'group-leave',
        json: variables.flag,
      });
    },
    {
      onMutate: async (variables) => {
        await queryClient.cancelQueries([GROUPS_KEY, variables.flag]);
        await queryClient.cancelQueries(['gangs', variables.flag]);
        await queryClient.cancelQueries(['gang-preview', variables.flag]);
        await queryClient.cancelQueries([GROUPS_KEY]);

        queryClient.setQueryData<Group | undefined>(
          [GROUPS_KEY, variables.flag],
          undefined
        );

        queryClient.setQueryData<Group | undefined>(
          ['gangs', variables.flag],
          undefined
        );

        queryClient.setQueryData<Group | undefined>(
          ['gang-preview', variables.flag],
          undefined
        );

        queryClient.setQueryData<Groups | undefined>([GROUPS_KEY], (old) => {
          if (!old) {
            return undefined;
          }
          const newGroups = old;
          delete newGroups[variables.flag];

          return newGroups;
        });
      },
      onSuccess: (_data, variables) => {
        captureGroupsAnalyticsEvent({
          name: 'group_exit',
          groupFlag: variables.flag,
          privacy: variables.privacy,
        });
      },
      onSettled: async (_data, _error, variables) => {
        queryClient.removeQueries(['gangs', variables.flag]);
        queryClient.removeQueries(['gang-preview', variables.flag]);
        queryClient.removeQueries([GROUPS_KEY, variables.flag]);
        await queryClient.invalidateQueries(['gangs']);
        await queryClient.invalidateQueries([GROUPS_KEY]);
      },
    }
  );
}

export function useGroupRescindMutation() {
  return useGroupMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-rescind',
      json: variables.flag,
    });
  });
}

export function useGroupCancelMutation() {
  return useGroupMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-cancel',
      json: variables.flag,
    });
  });
}

export function useGroupKnockMutation() {
  return useGroupMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-knock',
      json: variables.flag,
    });
  });
}

export function useGroupInviteMutation() {
  const mutationFn = (variables: { flag: string; ships: string[] }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        cordon: {
          shut: {
            'add-ships': {
              kind: 'pending',
              ships: variables.ships,
            },
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupRevokeMutation() {
  const mutationFn = (variables: {
    flag: string;
    ships: string[];
    kind: 'ask' | 'pending';
  }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        cordon: {
          shut: {
            'del-ships': {
              kind: variables.kind,
              ships: variables.ships,
            },
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupRejectMutation() {
  const queryClient = useQueryClient();
  const mutationFn = (variables: { flag: string }) =>
    api.trackedPoke<string, Gangs>(
      {
        app: 'groups',
        mark: 'invite-decline',
        json: variables.flag,
      },
      { app: 'gangs', path: '/updates' },
      (event) => {
        if (typeof event === 'object' && variables.flag in event) {
          return event[variables.flag].invite === null;
        }

        return false;
      }
    );

  return useGroupMutation(mutationFn, {
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['gangs']);
      queryClient.invalidateQueries(['gangs', variables.flag]);
    },
  });
}

export function useBaseVolumeSetMutation() {
  const queryClient = useQueryClient();
  const mutationFn = (variables: { volume: VolumeValue }) =>
    api.poke({
      app: 'groups',
      mark: 'volume-set',
      json: {
        value: variables.volume,
        scope: null,
      },
    });

  return useMutation(mutationFn, {
    onSuccess: () => {
      queryClient.invalidateQueries(['volume', 'base']);
    },
  });
}

export function useGroupVolumeSetMutation() {
  const queryClient = useQueryClient();
  const mutationFn = (variables: { flag: string; volume: VolumeValue }) =>
    api.poke({
      app: 'groups',
      mark: 'volume-set',
      json: {
        scope: {
          group: variables.flag,
        },
        value: variables.volume,
      },
    });

  return useMutation(mutationFn, {
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['volume', variables.flag]);
    },
  });
}

export function useGroupChannelVolumeSetMutation() {
  const queryClient = useQueryClient();
  const mutationFn = (variables: { nest: string; volume: VolumeValue }) =>
    api.poke({
      app: 'groups',
      mark: 'volume-set',
      json: {
        scope: {
          channel: variables.nest,
        },
        value: variables.volume,
      },
    });

  return useMutation(mutationFn, {
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['volume', variables.nest]);
    },
  });
}

export function useGroupSwapCordonMutation() {
  const mutationFn = (variables: { flag: string; cordon: Cordon }) =>
    api.poke(
      groupAction(variables.flag, {
        cordon: {
          swap: variables.cordon,
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupSetSecretMutation() {
  const mutationFn = (variables: { flag: string; isSecret: boolean }) =>
    api.poke(
      groupAction(variables.flag, {
        secret: variables.isSecret,
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupSectMutation() {
  const mutationFn = async (variables: {
    flag: string;
    ship: string;
    sects: string[];
    operation: 'add' | 'del';
  }) => {
    const diff =
      variables.operation === 'add'
        ? {
            'add-sects': variables.sects,
          }
        : { 'del-sects': variables.sects };
    return groupTrackedPoke(
      groupAction(variables.flag, {
        fleet: {
          ships: [variables.ship],
          diff,
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useGroupAddMembersMutation() {
  const mutationFn = async (variables: { flag: string; ships: string[] }) =>
    groupTrackedPoke(
      groupAction(variables.flag, {
        fleet: {
          ships: variables.ships,
          diff: {
            add: null,
          },
        },
      })
    );

  return useGroupMutation(mutationFn);
}

export function useGroupDelMembersMutation() {
  const mutationFn = async (variables: { flag: string; ships: string[] }) => {
    const diff = {
      fleet: {
        ships: variables.ships,
        diff: {
          del: null,
        },
      },
    };
    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupAddRoleMutation() {
  const mutationFn = async (variables: {
    flag: string;
    sect: string;
    meta: GroupMeta;
  }) => {
    const diff = {
      cabal: {
        sect: variables.sect,
        diff: {
          add: { ...variables.meta, image: '', cover: '' },
        },
      },
    };
    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupEditRoleMutation() {
  const mutationFn = async (variables: {
    flag: string;
    sect: string;
    meta: GroupMeta;
  }) => {
    const diff = {
      cabal: {
        sect: variables.sect,
        diff: {
          edit: { ...variables.meta, image: '', cover: '' },
        },
      },
    };
    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
}

export function useGroupDelRoleMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async ({ flag, sect }: { flag: string; sect: string }) => {
    const diff = {
      cabal: {
        sect,
        diff: { del: null },
      },
    };
    await api.poke(groupAction(flag, diff));
  };

  return useGroupMutation(mutationFn, {
    onMutate: ({ flag, sect }: { flag: string; sect: string }) => {
      // Optimistically remove role from cached group
      queryClient.setQueryData(
        [GROUPS_KEY, flag],
        (group: Group | undefined) => {
          if (!group?.cabals[sect]) {
            return group;
          }

          const nextGroup = { ...group };
          delete nextGroup.cabals[sect];
          return nextGroup;
        }
      );
    },
    onSettled: (data, err, { flag }: { flag: string }) => {
      queryClient.invalidateQueries([GROUPS_KEY, flag]);
    },
  });
}

export function useGroupIndex(ship: string) {
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: ['group-index', ship],
    app: 'groups',
    path: `/gangs/index/${ship}`,
    options: {
      enabled: ship !== '',
    },
  });

  return {
    groupIndex: data as GroupIndex,
    ...rest,
  };
}

export function useGroupHostHi(flag: string) {
  const { ship } = getFlagParts(flag);
  const connected = useGroupConnection(ship);
  const queryClient = useQueryClient();
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: ['group-host-hi', ship],
    app: 'groups',
    path: `/hi/${ship}`,
    options: {
      enabled: ship !== '' && preSig(window.ship) !== ship && !connected,
      cacheTime: 60 * 1000, // default to 1 minute before we check if the host is online again.
      retry: false,
      onSuccess: () => {
        queryClient.removeQueries(['group-host-hi', ship]);
      },
    },
  });

  return {
    ship: data as string,
    ...rest,
  };
}

export function useGroupPreviewFromIndex(flag: string) {
  const { ship } = getFlagParts(flag);
  const { groupIndex } = useGroupIndex(ship);

  return groupIndex?.[flag];
}

export function useGroupBanShipsMutation() {
  const mutationFn = async (variables: { flag: string; ships: string[] }) => {
    await api.poke(
      groupAction(variables.flag, {
        cordon: {
          open: {
            'add-ships': variables.ships,
          },
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useGroupUnbanShipsMutation() {
  // Not used yet.
  const mutationFn = async (variables: { flag: string; ships: string[] }) => {
    await api.poke(
      groupAction(variables.flag, {
        cordon: {
          open: {
            'del-ships': variables.ships,
          },
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useGroupBanRanksMutation() {
  // Not used yet.
  const mutationFn = async (variables: { flag: string; ranks: string[] }) => {
    await api.poke(
      groupAction(variables.flag, {
        cordon: {
          open: {
            'add-ranks': variables.ranks,
          },
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useGroupUnbanRanksMutation() {
  // Not used yet.
  const mutationFn = async (variables: { flag: string; ranks: string[] }) => {
    await api.poke(
      groupAction(variables.flag, {
        cordon: {
          open: {
            'del-ranks': variables.ranks,
          },
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useGroupCompatibility(flag: string) {
  const group = useGroup(flag);
  const saga = group?.saga || null;
  return {
    saga,
    compatible: sagaCompatible(saga),
    text: getCompatibilityText(saga),
  };
}

export function useFlagContentMutation() {
  const mutationFn = async (variables: {
    flag: string;
    nest: string;
    post: string;
    reply: string | null;
  }) => {
    await api.poke<GroupAction>(
      groupAction(variables.flag, {
        'flag-content': {
          nest: variables.nest,
          src: window.our,
          'post-key': {
            post: decToUd(variables.post),
            reply: variables.reply ? decToUd(variables.reply) : null,
          },
        },
      })
    );
  };

  return useGroupMutation(mutationFn);
}

export function useFlaggedData(
  flag: string,
  nest: string,
  postId: string,
  replyId?: string
) {
  const group = useGroup(flag);
  const empty = {
    flagData: undefined,
    isFlaggedByMe: false,
  };

  if (!group || !group['flagged-content'] || !group['flagged-content'][nest]) {
    return empty;
  }

  const flaggedContent = group['flagged-content'][nest];
  const flagData = flaggedContent[postId];

  if (!flagData) {
    return empty;
  }

  return {
    flagData,
    isFlaggedByMe: replyId
      ? flagData.replies[replyId]?.includes(window.our)
      : flagData.flagged && flagData.flaggers.includes(window.our),
  };
}
