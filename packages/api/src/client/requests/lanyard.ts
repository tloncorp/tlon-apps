import type { Entry } from './types';

export const lanyard = {
  // Both scries answer a noun: use scryNounRequest.
  twitterProofBundle: {
    kind: 'scry',
    agent: 'lanyard',
    path: '/v1/proof/twitter/bundle/{handle}',
    since: '12.2.0',
  },
  records: {
    kind: 'scry',
    agent: 'lanyard',
    path: '/v1/records',
    since: '12.2.0',
  },
  recordsFeed: {
    kind: 'subscribe',
    agent: 'lanyard',
    path: '/v1/records',
    since: '12.2.0',
  },
  queryResult: {
    kind: 'subscribe',
    agent: 'lanyard',
    path: '/v1/query/{nonce}',
    since: '12.2.0',
  },
  // Noun pokes: use pokeNounRequest / trackedPokeNounRequest.
  command: {
    kind: 'poke',
    agent: 'lanyard',
    mark: 'lanyard-command-1',
    since: '12.2.0',
  },
  query: {
    kind: 'poke',
    agent: 'lanyard',
    mark: 'lanyard-query-1',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
