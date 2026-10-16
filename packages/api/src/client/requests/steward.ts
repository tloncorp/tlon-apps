import type { Entry } from './types';

// The owner's side of the automation module: the mirror of a bot's scheduled
// tasks and the edit loop. The routes are a release older than their `since`,
// which is the release that added a task's delivery block: the client always
// reads and sends one.
//
// Still bot-facing, and excluded by oxlint/desk-request-scope.json: the bot's
// own side of automation (the harness feed and its finalize route).
export const steward = {
  automationTasks: {
    kind: 'scry',
    agent: 'steward',
    path: '/v1/automation/tasks',
    since: '12.3.1',
    guardedBy: 'deskSupportsAutomations',
  },
  automationTasksFeed: {
    kind: 'subscribe',
    agent: 'steward',
    path: '/v1/automation/tasks',
    since: '12.3.1',
    guardedBy: 'deskSupportsAutomations',
  },
  automationTasksHttp: {
    kind: 'http',
    agent: 'steward',
    method: 'GET',
    path: '/steward/~/v1/automation/tasks',
    since: '12.3.1',
    guardedBy: 'deskSupportsAutomations',
  },
  automationEdit: {
    kind: 'http',
    agent: 'steward',
    method: 'POST',
    path: '/steward/~/v1/automation',
    since: '12.3.1',
    guardedBy: 'deskSupportsAutomations',
  },
  automationRequest: {
    kind: 'http',
    agent: 'steward',
    method: 'GET',
    path: '/steward/~/v1/automation/request/{requestId}',
    since: '12.3.1',
    guardedBy: 'deskSupportsAutomations',
  },
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
    since: '12.4.0',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptEdit: {
    kind: 'http',
    agent: 'steward',
    method: 'POST',
    path: '/steward/~/v1/prompts',
    since: '12.4.0',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptRequest: {
    kind: 'http',
    agent: 'steward',
    method: 'GET',
    path: '/steward/~/v1/prompts/request/{requestId}',
    since: '12.4.0',
    guardedBy: 'deskSupportsStewardPrompts',
  },
  promptFeed: {
    kind: 'subscribe',
    agent: 'steward',
    path: '/v1/prompts/files',
    since: '12.4.0',
    guardedBy: 'deskSupportsStewardPrompts',
  },
} as const satisfies Record<string, Entry>;
