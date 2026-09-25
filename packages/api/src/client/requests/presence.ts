import type { Entry } from './types';

export const presence = {
  init: { kind: 'scry', agent: 'presence', path: '/v1/init', since: '12.2.0' },
  updates: {
    kind: 'subscribe',
    agent: 'presence',
    path: '/v1',
    since: '12.2.0',
  },
  action: {
    kind: 'poke',
    agent: 'presence',
    mark: 'presence-action-1',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
