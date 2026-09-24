import type { Entry } from './types';

export const buckets = {
  list: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  full: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/full',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  bucket: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/{host}/{name}',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  readToken: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/buckets/{host}/{name}/read-token',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  ready: {
    kind: 'scry',
    agent: 'buckets',
    path: '/v1/ready',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  updates: {
    kind: 'subscribe',
    agent: 'buckets',
    path: '/v1',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  action: {
    kind: 'http',
    agent: 'buckets',
    method: 'POST',
    path: '/buckets/~/v1',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
} as const satisfies Record<string, Entry>;
