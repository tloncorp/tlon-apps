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
