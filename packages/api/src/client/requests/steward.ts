import type { Entry } from './types';

// Automation routes (/v1/automation, /steward/~/v1/automation) are bot-facing
// and excluded by oxlint/desk-request-scope.json.
export const steward = {
  lensRecent: {
    kind: 'scry',
    agent: 'steward',
    path: '/v1/lens/recent',
    since: '12.2.0',
  },
  lensRecentN: {
    kind: 'scry',
    agent: 'steward',
    path: '/v1/lens/recent/{count}',
    since: '12.2.0',
  },
  lensRun: {
    kind: 'scry',
    agent: 'steward',
    path: '/v1/lens/run/{bot}/{lens}',
    since: '12.2.0',
  },
  lensSince: {
    kind: 'scry',
    agent: 'steward',
    path: '/v1/lens/since/{time}',
    since: '12.2.0',
  },
  lensFeed: {
    kind: 'subscribe',
    agent: 'steward',
    path: '/v1/lens',
    since: '12.2.0',
  },
  action: {
    kind: 'poke',
    agent: 'steward',
    mark: 'steward-action-1',
    since: '12.2.0',
  },
  gatewayAction: {
    kind: 'poke',
    agent: 'steward',
    mark: 'steward-gateway-action-1',
    since: '12.2.0',
  },
  lensAction: {
    kind: 'poke',
    agent: 'steward',
    mark: 'steward-lens-action-1',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
