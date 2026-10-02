import type { Entry } from './types';

export const groupsUi = {
  pins: { kind: 'scry', agent: 'groups-ui', path: '/pins', since: '12.2.0' },
  suggestedContacts: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/suggested-contacts',
    since: '12.2.0',
  },
  init: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v10/init',
    since: '12.2.0',
  },
  initBuckets: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v11/init',
    since: '12.3.0',
    guardedBy: 'deskSupportsBuckets',
  },
  changes: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v11/changes/{since}',
    since: '12.2.0',
  },
  initPosts: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v6/init-posts/{channels}/{context}',
    since: '12.2.0',
  },
  // groups-ui.hoon takes at most one trailing knot after /v4/heads.
  heads: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v4/heads',
    since: '12.2.0',
  },
  headsSince: {
    kind: 'scry',
    agent: 'groups-ui',
    path: '/v4/heads/{since}',
    since: '12.2.0',
  },
  action: {
    kind: 'poke',
    agent: 'groups-ui',
    mark: 'ui-action',
    since: '12.2.0',
  },
  addContactSuggestions: {
    kind: 'poke',
    agent: 'groups-ui',
    mark: 'ui-add-contact-suggestions',
    since: '12.2.0',
  },
  hideContact: {
    kind: 'poke',
    agent: 'groups-ui',
    mark: 'ui-hide-contact',
    since: '12.2.0',
  },
  vitaToggle: {
    kind: 'poke',
    agent: 'groups-ui',
    mark: 'ui-vita-toggle',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
