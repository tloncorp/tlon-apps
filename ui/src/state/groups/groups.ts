import { useParams } from 'react-router';
import { useMemo } from 'react';
import {
  MutationFunction,
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
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
  GroupMeta,
} from '@/types/groups';
import api, { useSubscriptionState } from '@/api';
import { BaitCite } from '@/types/chat';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';

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

export function useGroup(flag: string, withMembers = false) {
  const queryClient = useQueryClient();
  const initialData = queryClient.getQueryData(['groups']) as Groups;
  const group = initialData?.[flag];
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['group', flag],
    app: 'groups',
    path: `/groups/${flag}/ui`,
    initialScryPath: `/groups/${flag}`,
    enabled: !!flag && flag !== '' && withMembers,
    initialData: group,
  });

  if (rest.isLoading || rest.isError) {
    return undefined;
  }

  return {
    ...(data as Group),
  };
}

export function useGroups() {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['groups'],
    app: 'groups',
    path: `/groups/ui`,
    initialScryPath: `/groups/light`,
  });

  if (rest.isLoading || rest.isError) {
    return {} as Groups;
  }

  return data as Groups;
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
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['groups']) as Groups;

  return Object.keys(data || {});
}

export function useVessel(flag: string, ship: string) {
  const data = useGroup(flag);

  return (
    data?.fleet[ship] || {
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

export function useGang(flag: string) {
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['gangs', flag]) as Gangs;

  return data?.[flag] || defGang;
}

export function useGangs() {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['gangs'],
    app: 'groups',
    path: `/gangs/updates`,
    initialScryPath: `/gangs`,
    options: {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  });

  if (rest.isLoading || rest.isError) {
    return {} as Gangs;
  }

  return {
    ...(data as Gangs),
  };
}

export const useGangPreview = (flag: string, isScrolling?: boolean) => {
  const { data, ...rest } = useReactQuerySubscribeOnce<GroupPreview>({
    queryKey: ['gang-preview', flag],
    app: 'groups',
    path: `/gangs/${flag}/preview`,
    options: {
      enabled: !isScrolling,
    },
  });

  if (rest.isLoading || rest.isError) {
    return null;
  }

  return data as GroupPreview;
};

export function useGangList() {
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['gangs']) as Gangs;

  return Object.keys(data || {});
}

export function useChannel(
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
  const group = useGroup(flag, true);
  const vessel = group?.fleet?.[window.our];
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
      refetchOnWindowFocus: false,
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

export function useGroupMutation<TResponse>(
  mutationFn: MutationFunction<TResponse, any>,
  options?: UseMutationOptions<TResponse, unknown, any, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['group', variables.flag]);

      const data = await queryClient.getQueryData(['group', variables.flag]);
      const previousGroup = data as Group;

      const { zone, nest, idx, meta, index, metadata } = variables;

      if (metadata) {
        // edit group metadata
        queryClient.setQueryData(['group', variables.flag], {
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
            queryClient.setQueryData(['group', variables.flag], {
              ...previousGroup,
              'zone-ord': newZoneOrd,
            });
          }

          if (meta) {
            // edit zone metadata
            queryClient.setQueryData(['group', variables.flag], {
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

            queryClient.setQueryData(['group', variables.flag], {
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
          queryClient.setQueryData(['group', variables.flag], {
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
      queryClient.setQueryData(['group', variables.flag], previousGroup);
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries(['group', variables.flag]),
    ...options,
  });
}

export function useEditChannelMutation() {
  const mutationFn = (variables: {
    flag: string;
    nest: string;
    channel: GroupChannel;
  }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, {
          channel: {
            nest: variables.nest,
            diff: {
              edit: variables.channel,
            },
          },
        }),
        onError: () => reject(),
        onSuccess: async () => {
          useSubscriptionState.getState().track('groups/groups/ui', (event) => {
            if ('update' in event) {
              const { update } = event as GroupAction;
              return (
                'channel' in update.diff &&
                variables.nest === update.diff.channel.nest &&
                'add' in update.diff.channel.diff
              );
            }

            return false;
          });
          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useDeleteChannelMutation() {
  const mutationFn = (variables: { flag: string; nest: string }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, {
          channel: {
            nest: variables.nest,
            diff: {
              del: null,
            },
          },
        }),
        onError: () => reject(),
        onSuccess: async () => {
          useSubscriptionState.getState().track('groups/groups/ui', (event) => {
            if ('update' in event) {
              const { update } = event as GroupAction;
              return (
                'channel' in update.diff &&
                variables.nest === update.diff.channel.nest &&
                'del' in update.diff.channel.diff
              );
            }

            return false;
          });
          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useAddChannelMutation() {
  const mutationFn = (variables: {
    flag: string;
    zone: string;
    nest: string;
  }) => {
    const dif = {
      channel: {
        nest: variables.nest,
        diff: {
          zone: variables.zone,
        },
      },
    };
    return new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, dif),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if ('update' in event) {
                const { diff } = event.update;
                if ('channel' in diff) {
                  const { nest: channelNest, diff: channelDiff } = diff.channel;
                  if (channelNest === variables.nest && 'zone' in channelDiff) {
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
  };

  return useGroupMutation(mutationFn);
}

export function useGroupCreateZoneMutation() {
  const mutationFn = async (variables: {
    flag: string;
    zone: string;
    meta: GroupMeta;
  }) => {
    const dif = {
      zone: {
        zone: variables.zone,
        delta: {
          add: variables.meta,
        },
      },
    };
    await new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, dif),
        onError: () => reject(),
        onSuccess: async () => {
          useSubscriptionState.getState().track('groups/groups/ui', (event) => {
            if ('update' in event) {
              const { update } = event as GroupAction;
              return (
                'zone' in update.diff &&
                variables.zone === update.diff.zone.zone &&
                'add' in update.diff.zone.delta
              );
            }

            return false;
          });
          resolve();
        },
      });
    });
  };

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

export function useEditGroupMutation() {
  const mutationFn = (variables: { flag: string; metadata: GroupMeta }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, { meta: variables.metadata }),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if ('update' in event) {
                const { diff } = event.update;
                return (
                  'meta' in diff &&
                  diff.meta.title === variables.metadata.title &&
                  event.flag === variables.flag
                );
              }

              return false;
            });

          resolve();
        },
      });
    });
  return useGroupMutation(mutationFn);
}

export function useCreateGroupMutation() {
  const mutationFn = (variables: {
    name: string;
    title: string;
    description: string;
    members: Record<string, string[]>;
    cordon: Record<string, any>;
    secret: boolean;
  }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        app: 'groups',
        mark: 'group-create',
        json: variables,
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if ('update' in event) {
                const { update } = event as GroupAction;
                return (
                  'create' in update.diff &&
                  variables.title === update.diff.create.meta.title
                );
              }

              return false;
            });

          resolve();
        },
      });
    });

  return useMutation(mutationFn);
}

export function useDeleteGroupMutation() {
  const mutationFn = (variables: { flag: string }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, { del: null }),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if ('update' in event) {
                const { diff } = event.update;
                return 'del' in diff && event.flag === variables.flag;
              }

              return false;
            });

          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useGroupJoinMutation() {
  const mutationFn = (variables: { flag: string }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        app: 'groups',
        mark: 'group-join',
        json: {
          flag: variables.flag,
          'join-all': true,
        },
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if (typeof event === 'object' && 'flag' in event) {
                return variables.flag === event.flag;
              }

              return false;
            });

          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useGroupLeaveMutation() {
  return useGroupMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-leave',
      json: variables.flag,
    });
  });
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
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, {
          cordon: {
            shut: {
              'add-ships': {
                kind: 'pending',
                ships: variables.ships,
              },
            },
          },
        }),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              const { update, diff } = event;
              if (update && update.diff) {
                if ('cordon' in update.diff) {
                  const { shut } = update.diff.cordon;
                  if ('add-ships' in shut) {
                    const { kind, ships: addedShips } = shut['add-ships'];
                    return (
                      kind === 'pending' &&
                      addedShips.every((ship: string) =>
                        variables.ships.includes(ship)
                      )
                    );
                  }
                  return false;
                }
                return false;
              }
              if (diff && 'cordon' in diff) {
                const { shut } = diff.cordon;
                if ('add-ships' in shut) {
                  const { kind, ships: addedShips } = shut['add-ships'];
                  return (
                    kind === 'pending' &&
                    addedShips.every((ship: string) =>
                      variables.ships.includes(ship)
                    )
                  );
                }
                return false;
              }
              return false;
            });
          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useGroupRevokeMutation() {
  const mutationFn = (variables: {
    flag: string;
    ships: string[];
    kind: 'ask' | 'pending';
  }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, {
          cordon: {
            shut: {
              'del-ships': {
                kind: variables.kind,
                ships: variables.ships,
              },
            },
          },
        }),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              const { update, diff } = event;
              if (update && update.diff) {
                if ('cordon' in update.diff) {
                  const { shut } = update.diff.cordon;
                  if ('del-ships' in shut) {
                    const { kind: returnedKind, ships: addedShips } =
                      shut['del-ships'];
                    return (
                      returnedKind === 'pending' &&
                      addedShips.every((ship: string) =>
                        variables.ships.includes(ship)
                      )
                    );
                  }
                  return false;
                }
                return false;
              }
              if (diff && 'cordon' in diff) {
                const { shut } = diff.cordon;
                if ('del-ships' in shut) {
                  const { kind: returnedKind, ships: addedShips } =
                    shut['del-ships'];
                  return (
                    returnedKind === 'pending' &&
                    addedShips.every((ship: string) =>
                      variables.ships.includes(ship)
                    )
                  );
                }
                return false;
              }
              return false;
            });

          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
}

export function useGroupRejectMutation() {
  const queryClient = useQueryClient();
  const mutationFn = (variables: { flag: string }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        app: 'groups',
        mark: 'invite-decline',
        json: variables.flag,
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('gangs/updates', (event) => {
              const { json } = event;
              if (json && variables.flag in json) {
                return json[variables.flag].invite === null;
              }

              return false;
            });

          queryClient.invalidateQueries(['gangs']);
          queryClient.invalidateQueries(['gangs', variables.flag]);
          resolve();
        },
      });
    });

  return useGroupMutation(mutationFn);
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

export function useGroupAddSectsMutation() {
  const mutationFn = async (variables: {
    flag: string;
    ship: string;
    sects: string[];
  }) => {
    const dif = {
      fleet: {
        ships: [variables.ship],
        diff: {
          'add-sects': variables.sects,
        },
      },
    };
    await new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, dif),
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
                  diff.fleet.ships.includes(variables.ship) &&
                  event.flag === variables.flag
                );
              }

              return false;
            });

          resolve();
        },
      });
    });
  };

  return useGroupMutation(mutationFn);
}

export function useGroupDelSectsMutation() {
  const mutationFn = async (variables: {
    flag: string;
    ship: string;
    sects: string[];
  }) => {
    const dif = {
      fleet: {
        ships: [variables.ship],
        diff: {
          'del-sects': variables.sects,
        },
      },
    };
    await new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, dif),
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
                  diff.fleet.ships.includes(variables.ship) &&
                  event.flag === variables.flag
                );
              }

              return false;
            });

          resolve();
        },
      });
    });
  };

  return useGroupMutation(mutationFn);
}

export function useGroupAddMembersMutation() {
  const mutationFn = async (variables: { flag: string; ships: string[] }) => {
    const diff = {
      fleet: {
        ships: variables.ships,
        diff: {
          add: null,
        },
      },
    };
    await new Promise<void>((resolve, reject) => {
      api.poke({
        ...groupAction(variables.flag, diff),
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              if ('update' in event) {
                const { diff: eventDiff } = event.update;
                if ('fleet' in eventDiff) {
                  const {
                    ships: fleetShips,
                    diff: { add },
                  } = eventDiff.fleet;
                  return (
                    fleetShips.every((s: string) => fleetShips.includes(s)) &&
                    add === null
                  );
                }
                return false;
              }

              return false;
            });
          resolve();
        },
      });
    });
  };

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
  // Not used yet.
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

export function useGroupDelRoleMutation() {
  // Not used yet.
  const mutationFn = async (variables: { flag: string; sect: string }) => {
    const diff = {
      cabal: {
        sect: variables.sect,
        diff: { del: null },
      },
    };
    await api.poke(groupAction(variables.flag, diff));
  };

  return useGroupMutation(mutationFn);
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

  if (rest.isLoading) {
    return null;
  }

  if (rest.isError) {
    throw new Error('Failed to fetch group index');
  }

  return data as GroupIndex;
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
