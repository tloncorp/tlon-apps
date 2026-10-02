import type { Entry } from './types';

export const contacts = {
  book: { kind: 'scry', agent: 'contacts', path: '/v1/book', since: '12.2.0' },
  directory: {
    kind: 'scry',
    agent: 'contacts',
    path: '/v1/directory',
    since: '12.2.0',
  },
  news: {
    kind: 'subscribe',
    agent: 'contacts',
    path: '/v1/news',
    since: '12.2.0',
  },
  // contact-action-1 (self/meet) and contact-action (edit) are separate
  // protocols, each used on its own.
  action1: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-action-1',
    since: '12.2.0',
  },
  action0: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-action',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
