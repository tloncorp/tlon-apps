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
  // %grouper's enable poke, served by %reel from the %tlon desk on. Older
  // desks take it at %grouper (base.grouperEnable); see enableGroup.
  enableGroup: {
    kind: 'poke',
    agent: 'reel',
    mark: 'grouper-enable',
    since: '13.0.0',
    guardedBy: 'deskServesLureOnReel',
  },
} as const satisfies Record<string, Entry>;
