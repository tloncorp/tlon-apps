import type { PresenceEvent, PresenceStatus } from '@tloncorp/api';
import { beforeEach, expect, test } from 'vitest';

import {
  clearPresenceState,
  getConversationPresence,
  handlePresenceEvent,
  reducePresenceState,
} from './presence';

const FIRST_SINCE = new Date('2026-04-07T10:00:00.000Z').getTime();
const SECOND_SINCE = new Date('2026-04-07T10:00:30.000Z').getTime();

const typingStatus: PresenceStatus = {
  key: {
    context: '/channel/chat/~bus/general',
    ship: '~nec',
    topic: 'typing',
  },
  timing: { since: FIRST_SINCE, timeout: '~s30' },
  display: { icon: null, text: 'Typing...', blob: null },
  contextId: 'chat/~bus/general',
};

const computingStatus: PresenceStatus = {
  key: {
    context: '/dm/~zod',
    ship: '~nec',
    topic: 'computing',
  },
  timing: { since: SECOND_SINCE, timeout: '~m1' },
  display: { icon: null, text: 'Thinking...', blob: null },
  contextId: '~nec',
};

beforeEach(() => {
  clearPresenceState();
});

test('reducePresenceState buckets init states by normalized context id', () => {
  const event: PresenceEvent = {
    type: 'init',
    states: [
      typingStatus,
      computingStatus,
      {
        ...computingStatus,
        key: {
          context: '/dm/~someone',
          ship: '~else',
          topic: 'typing',
        },
        contextId: null,
      },
    ],
  };

  expect(reducePresenceState({}, event)).toStrictEqual({
    'chat/~bus/general': {
      '/channel/chat/~bus/general|~nec|typing': typingStatus,
    },
    '~nec': {
      '/dm/~zod|~nec|computing': computingStatus,
    },
  });
});

test('presence store scopes set and clear events to a single conversation', () => {
  handlePresenceEvent({
    type: 'init',
    states: [typingStatus],
  });

  handlePresenceEvent({
    type: 'set',
    state: computingStatus,
  });

  expect(getConversationPresence('chat/~bus/general')).toStrictEqual([
    typingStatus,
  ]);
  expect(getConversationPresence('~nec')).toStrictEqual([computingStatus]);

  handlePresenceEvent({
    type: 'clear',
    key: computingStatus.key,
    contextId: computingStatus.contextId,
  });

  expect(getConversationPresence('~nec')).toStrictEqual([]);
  expect(getConversationPresence('chat/~bus/general')).toStrictEqual([
    typingStatus,
  ]);
});
