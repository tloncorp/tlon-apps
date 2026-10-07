import type { Entry } from './types';

export const groups = {
  groups: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/groups',
    since: '12.2.0',
  },
  uiGroup: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/ui/groups/{groupId*}',
    since: '12.2.0',
  },
  // The group with init's light roster and a count of every seat: how a big
  // group syncs without pulling the whole roster.
  uiGroupLight: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/ui/groups/{groupId*}/light',
    since: '12.3.2',
    guardedBy: 'deskServesRosterPages',
  },
  // A big group's roster a page at a time, in @p order after `after`.
  seatsPage: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/groups/{groupId*}/seats/page/{limit}',
    since: '12.3.2',
    guardedBy: 'deskServesRosterPages',
  },
  seatsPageAfter: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/groups/{groupId*}/seats/page/{limit}/{after}',
    since: '12.3.2',
    guardedBy: 'deskServesRosterPages',
  },
  roleSeatsPage: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/groups/{groupId*}/seats/role/{roleId}/page/{limit}',
    since: '12.3.2',
    guardedBy: 'deskServesRosterPages',
  },
  roleSeatsPageAfter: {
    kind: 'scry',
    agent: 'groups',
    path: '/v3/groups/{groupId*}/seats/role/{roleId}/page/{limit}/{after}',
    since: '12.3.2',
    guardedBy: 'deskServesRosterPages',
  },
  negotiateStatus: {
    kind: 'scry',
    agent: 'groups',
    path: '/~/negotiate/status/json',
    since: '12.2.0',
  },
  updates: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/v3/groups',
    since: '12.2.0',
  },
  foreigns: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/v1/foreigns',
    since: '12.2.0',
  },
  gangPreview: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/gangs/{groupId*}/preview',
    since: '12.2.0',
  },
  channelPreview: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/v1/channels/{app}/{ship}/{name}/preview',
    since: '7.3.0',
  },
  gangIndex: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/gangs/index/{ship}',
    since: '12.2.0',
  },
  negotiateNotify: {
    kind: 'subscribe',
    agent: 'groups',
    path: '/~/negotiate/notify/json',
    since: '12.2.0',
  },
  action: {
    kind: 'poke',
    agent: 'groups',
    mark: 'group-action-5',
    since: '12.2.0',
  },
  cancel: {
    kind: 'poke',
    agent: 'groups',
    mark: 'group-cancel',
    since: '12.2.0',
  },
  join: { kind: 'poke', agent: 'groups', mark: 'group-join', since: '12.2.0' },
  knock: {
    kind: 'poke',
    agent: 'groups',
    mark: 'group-knock',
    since: '12.2.0',
  },
  leave: {
    kind: 'poke',
    agent: 'groups',
    mark: 'group-leave',
    since: '12.2.0',
  },
  rescind: {
    kind: 'poke',
    agent: 'groups',
    mark: 'group-rescind',
    since: '12.2.0',
  },
  inviteDecline: {
    kind: 'poke',
    agent: 'groups',
    mark: 'invite-decline',
    since: '12.2.0',
  },
  create: {
    kind: 'thread',
    agent: 'groups',
    name: 'group-create-1',
    inputMark: 'group-create-thread',
    outputMark: 'group-ui-2',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
