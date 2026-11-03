import type { Entry } from './types';

export const buckets = {
  list: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
  full: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/full',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
  bucket: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/{host}/{name}',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
  readToken: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/{host}/{name}/read-token',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
  updates: {
    kind: 'subscribe',
    agent: 'buckets',
    path: '/v1',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
  action: {
    kind: 'http',
    agent: 'buckets',
    method: 'POST',
    path: '/buckets/~/v1',
    since: '12.3.0',
    guardedBy: 'buckets',
  },
} as const satisfies Record<string, Entry>;
