import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import { useParams } from 'react-router';
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import _ from 'lodash';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { GroupState } from './type';

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

const emptyGroup: Group = {
  fleet: {},
  cabals: {},
  channels: {
    '~': {
      readers: [],
      added: 0,
      join: false,
      meta: {
        title: '',
        description: '',
        image: '',
        cover: '',
      },
      zone: '',
    },
  },
  cordon: {
    open: {
      ships: [],
      ranks: [],
    },
  },
  meta: {
    title: '',
    description: '',
    image: '',
    cover: '',
  },
  zones: {
    '~': {
      meta: {
        title: '',
        description: '',
        image: '',
        cover: '',
      },
      idx: [''],
    },
  },
  'zone-ord': [],
  bloc: [],
  secret: false,
};

export function useGroup(flag: string) {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['group', flag],
    app: 'groups',
    path: `/groups/${flag}/ui`,
    initialScryPath: `/groups/${flag}`,
    options: {
      enabled: !!flag && flag !== '',
    },
  });

  if (rest.isLoading || rest.isError) {
    return null;
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
    initialScryPath: `/groups`,
  });

  if (rest.isLoading || rest.isError) {
    return {
      '~zod/fake': emptyGroup,
    };
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
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['group', flag]) as Group;

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

  const data = queryClient.getQueryData(['gangs']) as Gangs;

  return data?.[flag] || defGang;
}

export function useGangs() {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['gangs'],
    app: 'groups',
    path: `/gangs/updates`,
    initialScryPath: `/gangs`,
  });

  if (rest.isLoading || rest.isError) {
    return {
      '~zod/fake': defGang,
    } as Gangs;
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
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['group', flag]) as Group;

  return data?.channels[channel];
}

export function useChannelList(flag: string): string[] {
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(['group', flag]) as Group;

  return Object.keys(data?.channels || {});
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

export function useEditChannelMutation() {
  const mutateFn = (variables: {
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

  return useMutation(mutateFn);
}

export function useDeleteChannelMutation() {
  const mutateFn = (variables: { flag: string; nest: string }) =>
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

  return useMutation(mutateFn);
}

export function useAddChannelMutation() {
  const mutateFn = (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupCreateZoneMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupEditZoneMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupMoveZoneMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupDeleteZoneMutation() {
  const mutateFn = async (variables: { flag: string; zone: string }) => {
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

  return useMutation(mutateFn);
}

export function useGroupMoveChannelMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useEditGroupMutation() {
  const mutateFn = (variables: { flag: string; metadata: GroupMeta }) =>
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
  return useMutation(mutateFn);
}

export function useCreateGroupMutation() {
  const mutateFn = (variables: {
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

  return useMutation(mutateFn);
}

export function useDeleteGroupMutation() {
  const mutateFn = (variables: { flag: string }) =>
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

  return useMutation(mutateFn);
}

export function useGroupJoinMutation() {
  const mutateFn = (variables: { flag: string }) =>
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

  return useMutation(mutateFn);
}

export function useGroupLeaveMutation() {
  return useMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-leave',
      json: variables.flag,
    });
  });
}

export function useGroupRescindMutation() {
  return useMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-rescind',
      json: variables.flag,
    });
  });
}

export function useGroupCancelMutation() {
  return useMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-cancel',
      json: variables.flag,
    });
  });
}

export function useGroupKnockMutation() {
  return useMutation(async (variables: { flag: string }) => {
    await api.poke({
      app: 'groups',
      mark: 'group-knock',
      json: variables.flag,
    });
  });
}

export function useGroupInviteMutation() {
  const mutateFn = (variables: { flag: string; ships: string[] }) =>
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

  return useMutation(mutateFn);
}

export function useGroupRevokeMutation() {
  const mutateFn = (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupRejectMutation() {
  const mutateFn = (variables: { flag: string }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        app: 'groups',
        mark: 'invite-decline',
        json: variables.flag,
        onError: () => reject(),
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('groups/groups/ui', (event) => {
              const { json } = event;
              if (json && variables.flag in json) {
                return json[variables.flag].invite === null;
              }

              return false;
            });

          resolve();
        },
      });
    });

  return useMutation(mutateFn);
}

export function useGroupSwapCordonMutation() {
  const mutateFn = (variables: { flag: string; cordon: Cordon }) =>
    api.poke(
      groupAction(variables.flag, {
        cordon: {
          swap: variables.cordon,
        },
      })
    );

  return useMutation(mutateFn);
}

export function useGroupSetSecretMutation() {
  const mutateFn = (variables: { flag: string; isSecret: boolean }) =>
    api.poke(
      groupAction(variables.flag, {
        secret: variables.isSecret,
      })
    );

  return useMutation(mutateFn);
}

export function useGroupAddSectsMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupDelSectsMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupAddMembersMutation() {
  const mutateFn = async (variables: { flag: string; ships: string[] }) => {
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

  return useMutation(mutateFn);
}

export function useGroupDelMembersMutation() {
  const mutateFn = async (variables: { flag: string; ships: string[] }) => {
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

  return useMutation(mutateFn);
}

export function useGroupAddRoleMutation() {
  const mutateFn = async (variables: {
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

  return useMutation(mutateFn);
}

export function useGroupDelRoleMutation() {
  const mutateFn = async (variables: { flag: string; sect: string }) => {
    const diff = {
      cabal: {
        sect: variables.sect,
        diff: { del: null },
      },
    };
    await api.poke(groupAction(variables.flag, diff));
  };

  return useMutation(mutateFn);
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
  const mutateFn = async (variables: { flag: string; ships: string[] }) => {
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

  return useMutation(mutateFn);
}

export function useGroupUnbanShipsMutation() {
  const mutateFn = async (variables: { flag: string; ships: string[] }) => {
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

  return useMutation(mutateFn);
}

export function useGroupBanRanksMutation() {
  const mutateFn = async (variables: { flag: string; ranks: string[] }) => {
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

  return useMutation(mutateFn);
}

export function useGroupUnbanRanksMutation() {
  const mutateFn = async (variables: { flag: string; ranks: string[] }) => {
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

  return useMutation(mutateFn);
}
