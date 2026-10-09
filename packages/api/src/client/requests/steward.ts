import type { Entry } from './types';

// Automation routes (/v1/automation and its /steward/~/v1 HTTP form) are
// bot-facing and excluded by oxlint/desk-request-scope.json.
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
  promptFiles: {
    kind: 'http',
    agent: 'steward',
    method: 'GET',
    path: '/steward/~/v1/prompts/files',
    since: '12.3.2',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptEdit: {
    kind: 'http',
    agent: 'steward',
    method: 'POST',
    path: '/steward/~/v1/prompts',
    since: '12.3.2',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptRequest: {
    kind: 'http',
    agent: 'steward',
    method: 'GET',
    path: '/steward/~/v1/prompts/request/{requestId}',
    since: '12.3.2',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptFeed: {
    kind: 'subscribe',
    agent: 'steward',
    path: '/v1/prompts/files',
    since: '12.3.2',
    guardedBy: 'deskSupportsStewardPrompts',
  },
} as const satisfies Record<string, Entry>;
