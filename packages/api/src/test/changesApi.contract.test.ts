import { beforeAll, describe, expect, test } from 'vitest';

import { parseChanges } from '../client/changesApi';
import { configureClient } from '../client/urbit';
import rawContactBook from './fixtures/contactBook.json';
import rawGroupsInit6 from './fixtures/groupsInit5.json';
import type * as ub from '../urbit';

const contactBook = rawContactBook as unknown as ub.ContactBookScryResult1;
const groupsInit6 = rawGroupsInit6 as unknown as ub.GroupsInit6;

describe('parseChanges contract', () => {
  beforeAll(() => {
    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });
  });

  test('returns stable shape for empty channel/chat changes', () => {
    const [contactId, contactEntry] = Object.entries(contactBook)[0] as [
      string,
      ub.ContactBookEntry,
    ];

    const result = parseChanges({
      groups: groupsInit6.groups,
      channels: {},
      chat: {},
      contacts: {
        [contactId]: contactEntry,
      },
      activity: {} as ub.Activity,
    });

    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.posts).toEqual([]);
    expect(result.deletedChannelIds).toEqual([]);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toHaveProperty('id', contactId);
    expect(result.unreads).toBeDefined();
  });

  test('extracts deleted channel ids from null entries', () => {
    const result = parseChanges({
      groups: {},
      channels: {
        '/fake/channel-id': null,
      },
      chat: {},
      contacts: {},
      activity: {} as ub.Activity,
    });

    expect(result.deletedChannelIds).toEqual(['/fake/channel-id']);
  });
});
