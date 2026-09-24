import type { Entry } from './types';

// Agents outside the %groups desk carry the desk that owns them; the
// registry check holds the ownership map. %genuine, %grouper, %notify and
// %metagrab ship in %groups.
export const base = {
  kilnPikes: {
    kind: 'scry',
    agent: 'hood',
    path: '/kiln/pikes',
    desk: 'base',
    since: '12.2.0',
  },
  kilnLag: {
    kind: 'scry',
    agent: 'hood',
    path: '/kiln/lag',
    desk: 'base',
    since: '12.2.0',
  },
  charges: {
    kind: 'scry',
    agent: 'docket',
    path: '/charges',
    desk: 'landscape',
    since: '12.2.0',
  },
  settingsDesk: {
    kind: 'scry',
    agent: 'settings',
    path: '/desk/{desk}',
    desk: 'landscape',
    since: '12.2.0',
  },
  settingsDeskUpdates: {
    kind: 'subscribe',
    agent: 'settings',
    path: '/desk/{desk}',
    desk: 'landscape',
    since: '12.2.0',
  },
  settingsEvent: {
    kind: 'poke',
    agent: 'settings',
    mark: 'settings-event',
    desk: 'landscape',
    since: '12.2.0',
  },
  storageConfiguration: {
    kind: 'scry',
    agent: 'storage',
    path: '/configuration',
    desk: 'landscape',
    since: '12.2.0',
  },
  storageCredentials: {
    kind: 'scry',
    agent: 'storage',
    path: '/credentials',
    desk: 'landscape',
    since: '12.2.0',
  },
  storageAll: {
    kind: 'subscribe',
    agent: 'storage',
    path: '/all',
    desk: 'landscape',
    since: '12.2.0',
  },
  vitalsShip: {
    kind: 'scry',
    agent: 'vitals',
    path: '/ship/{ship}',
    desk: 'landscape',
    since: '12.2.0',
  },
  vitalsStatus: {
    kind: 'subscribe',
    agent: 'vitals',
    path: '/status/{ship}',
    desk: 'landscape',
    since: '12.2.0',
  },
  vitalsRunCheck: {
    kind: 'poke',
    agent: 'vitals',
    mark: 'run-check',
    desk: 'landscape',
    since: '12.2.0',
  },
  genuineSecret: {
    kind: 'scry',
    agent: 'genuine',
    path: '/secret',
    since: '12.2.0',
  },
  grouperEnable: {
    kind: 'poke',
    agent: 'grouper',
    mark: 'grouper-enable',
    since: '12.2.0',
  },
  notifyClientAction: {
    kind: 'poke',
    agent: 'notify',
    mark: 'notify-client-action',
    since: '12.2.0',
  },
  // Unauthenticated fetch: use rawRequest.
  metagrab: {
    kind: 'http',
    agent: 'metagrab',
    method: 'GET',
    path: '/apps/groups/~/metagrab/{url}',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
