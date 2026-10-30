import type { Entry } from './types';

export const contacts = {
  init3: {
    kind: 'scry',
    agent: 'contacts',
    path: '/v3/init',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactDecisions',
  },
  decline: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-decline-1',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactDecisions',
  },
  init2: {
    kind: 'scry',
    agent: 'contacts',
    path: '/v2/init',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactRemoval',
  },
  discover1: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-discover-1',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactDecisions',
  },
  discover: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-discover',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactRemoval',
  },
  remove: {
    kind: 'poke',
    agent: 'contacts',
    mark: 'contact-remove',
    since: '12.5.0',
    guardedBy: 'deskSupportsContactRemoval',
  },
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
