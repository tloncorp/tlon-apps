import type { Entry } from './types';

export const reel = {
  bait: { kind: 'scry', agent: 'reel', path: '/bait', since: '12.2.0' },
  idUrl: {
    kind: 'scry',
    agent: 'reel',
    path: '/v1/id-url/{id*}',
    since: '12.2.0',
  },
  idLink: {
    kind: 'subscribe',
    agent: 'reel',
    path: '/v1/id-link/{id*}',
    since: '12.2.0',
  },
  describe: {
    kind: 'poke',
    agent: 'reel',
    mark: 'reel-describe',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
