import type { Entry } from './types';

// Versioned pairs (fullV6/fullV4, feedV7/V6/V5, action2/1/0, ...) are chosen
// at the call site by the client's capability flags, which are false until
// the probe reports. Each is served by the floor desk.
export const activity = {
  fullV6: {
    kind: 'scry',
    agent: 'activity',
    path: '/v6/activity',
    since: '12.2.0',
  },
  fullV4: {
    kind: 'scry',
    agent: 'activity',
    path: '/v4/activity',
    since: '12.2.0',
  },
  channelThreads: {
    kind: 'scry',
    agent: 'activity',
    path: '/v4/activity/threads/{groupHost}/{groupName}/{kind}/{channelHost}/{channelName}',
    since: '12.2.0',
  },
  dmThreads: {
    kind: 'scry',
    agent: 'activity',
    path: '/v4/activity/dm-threads/{id}',
    since: '12.2.0',
  },
  noteThreads: {
    kind: 'scry',
    agent: 'activity',
    path: '/v6/activity/notes/{host}/{name}',
    since: '12.2.0',
  },
  volumeSettingsV6: {
    kind: 'scry',
    agent: 'activity',
    path: '/v6/volume-settings',
    since: '12.2.0',
  },
  volumeSettings: {
    kind: 'scry',
    agent: 'activity',
    path: '/volume-settings',
    since: '12.2.0',
  },
  feedInitV7: {
    kind: 'scry',
    agent: 'activity',
    path: '/v7/feed/init/{count}',
    since: '12.2.0',
  },
  feedInitV6: {
    kind: 'scry',
    agent: 'activity',
    path: '/v6/feed/init/{count}',
    since: '12.2.0',
  },
  feedInitV5: {
    kind: 'scry',
    agent: 'activity',
    path: '/v5/feed/init/{count}',
    since: '12.2.0',
  },
  feedV7: {
    kind: 'scry',
    agent: 'activity',
    path: '/v7/feed/{bucket}/{count}/{cursor}',
    since: '12.2.0',
  },
  feedV6: {
    kind: 'scry',
    agent: 'activity',
    path: '/v6/feed/{bucket}/{count}/{cursor}',
    since: '12.2.0',
  },
  feedV5: {
    kind: 'scry',
    agent: 'activity',
    path: '/v5/feed/{bucket}/{count}/{cursor}',
    since: '12.2.0',
  },
  notificationsAllowed: {
    kind: 'scry',
    agent: 'activity',
    path: '/notifications-allowed',
    since: '12.2.0',
  },
  updatesV6: {
    kind: 'subscribe',
    agent: 'activity',
    path: '/v6',
    since: '12.2.0',
  },
  updatesV5: {
    kind: 'subscribe',
    agent: 'activity',
    path: '/v5',
    since: '12.2.0',
  },
  updatesV4: {
    kind: 'subscribe',
    agent: 'activity',
    path: '/v4',
    since: '12.2.0',
  },
  action2: {
    kind: 'poke',
    agent: 'activity',
    mark: 'activity-action-2',
    since: '12.2.0',
  },
  action1: {
    kind: 'poke',
    agent: 'activity',
    mark: 'activity-action-1',
    since: '12.2.0',
  },
  action0: {
    kind: 'poke',
    agent: 'activity',
    mark: 'activity-action',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
