import { describe, expect, test } from 'vitest';

import {
  conversationIdToPresenceContext,
  getPresenceContextIdFromKey,
  groupIdToPresenceContext,
  toPresenceEvent,
  toPresenceStatuses,
} from '../client/presenceApi';
import type * as ub from '../urbit';

const CURRENT_USER_ID = '~zod';

describe('presenceApi', () => {
  test('builds DM and channel presence contexts from conversation ids', () => {
    expect(conversationIdToPresenceContext('~nec')).toBe('/dm/~nec');
    expect(conversationIdToPresenceContext('chat/~bus/general')).toBe(
      '/channel/chat/~bus/general'
    );
  });

  test('builds group presence contexts from group ids', () => {
    expect(groupIdToPresenceContext('~bus/community')).toBe(
      '/group/~bus/community'
    );
  });

  test('normalizes both sides of a DM to the same conversation id', () => {
    expect(
      getPresenceContextIdFromKey(
        {
          context: '/dm/~nec',
          ship: CURRENT_USER_ID,
          topic: 'computing',
        },
        CURRENT_USER_ID
      )
    ).toBe('~nec');

    expect(
      getPresenceContextIdFromKey(
        {
          context: `/dm/${CURRENT_USER_ID}`,
          ship: '~nec',
          topic: 'computing',
        },
        CURRENT_USER_ID
      )
    ).toBe('~nec');
  });

  test('normalizes channel and group contexts', () => {
    expect(
      getPresenceContextIdFromKey(
        {
          context: '/channel/chat/~bus/general',
          ship: '~nec',
          topic: 'typing',
        },
        CURRENT_USER_ID
      )
    ).toBe('chat/~bus/general');

    expect(
      getPresenceContextIdFromKey(
        {
          context: '/group/~bus/community',
          ship: '~nec',
          topic: 'other',
        },
        CURRENT_USER_ID
      )
    ).toBe('~bus/community');
  });

  test('flattens presence init state into normalized statuses', () => {
    const places: ub.PresencePlaces = {
      [`/dm/${CURRENT_USER_ID}`]: {
        computing: {
          '~nec': {
            timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
            display: { icon: null, text: 'Thinking...', blob: null },
          },
        },
      },
      '/channel/chat/~bus/general': {
        typing: {
          '~marzod': {
            timing: { since: '~2026.3.25..12.00.30', timeout: '~s30' },
            display: { icon: null, text: 'Typing...', blob: null },
          },
        },
      },
    };

    expect(toPresenceStatuses(places, CURRENT_USER_ID)).toStrictEqual([
      {
        key: {
          context: `/dm/${CURRENT_USER_ID}`,
          ship: '~nec',
          topic: 'computing',
        },
        timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
        display: { icon: null, text: 'Thinking...', blob: null },
        contextId: '~nec',
      },
      {
        key: {
          context: '/channel/chat/~bus/general',
          ship: '~marzod',
          topic: 'typing',
        },
        timing: { since: '~2026.3.25..12.00.30', timeout: '~s30' },
        display: { icon: null, text: 'Typing...', blob: null },
        contextId: 'chat/~bus/general',
      },
    ]);
  });

  test('maps presence response events into normalized client events', () => {
    expect(
      toPresenceEvent(
        {
          here: {
            key: {
              context: `/dm/${CURRENT_USER_ID}`,
              ship: '~nec',
              topic: 'computing',
            },
            timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
            display: { icon: null, text: 'Thinking...', blob: null },
          },
        },
        CURRENT_USER_ID
      )
    ).toStrictEqual({
      type: 'set',
      state: {
        key: {
          context: `/dm/${CURRENT_USER_ID}`,
          ship: '~nec',
          topic: 'computing',
        },
        timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
        display: { icon: null, text: 'Thinking...', blob: null },
        contextId: '~nec',
      },
    });

    expect(
      toPresenceEvent(
        {
          gone: {
            context: `/dm/${CURRENT_USER_ID}`,
            ship: '~nec',
            topic: 'computing',
          },
        },
        CURRENT_USER_ID
      )
    ).toStrictEqual({
      type: 'clear',
      key: {
        context: `/dm/${CURRENT_USER_ID}`,
        ship: '~nec',
        topic: 'computing',
      },
      contextId: '~nec',
    });
  });
});
