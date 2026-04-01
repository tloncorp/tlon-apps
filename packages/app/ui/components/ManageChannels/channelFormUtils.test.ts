import { describe, expect, test } from 'vitest';

import {
  MEMBERS_MARKER,
  MEMBER_ROLE_OPTION,
  getChannelPrivacyDefaults,
  groupRolesToOptions,
  mapRoleIdsToOptions,
} from './channelFormUtils';

describe('groupRolesToOptions', () => {
  test('converts group roles to options', () => {
    const roles = [
      { id: 'admin', title: 'Admin' },
      { id: 'moderator', title: 'Moderator' },
    ] as any[];

    expect(groupRolesToOptions(roles)).toEqual([
      { label: 'Admin', value: 'admin' },
      { label: 'Moderator', value: 'moderator' },
    ]);
  });

  test('handles missing title', () => {
    const roles = [{ id: 'role1', title: null }] as any[];
    expect(groupRolesToOptions(roles)).toEqual([
      { label: 'Unknown role', value: 'role1' },
    ]);
  });

  test('handles missing id', () => {
    const roles = [{ id: null, title: 'Some Role' }] as any[];
    expect(groupRolesToOptions(roles)).toEqual([
      { label: 'Some Role', value: '' },
    ]);
  });

  test('handles empty array', () => {
    expect(groupRolesToOptions([])).toEqual([]);
  });
});

describe('mapRoleIdsToOptions', () => {
  const allRoles = [
    { label: 'Admin', value: 'admin' },
    { label: 'Moderator', value: 'moderator' },
    MEMBER_ROLE_OPTION,
  ];

  test('maps role IDs to their full options', () => {
    expect(mapRoleIdsToOptions(['admin', 'moderator'], allRoles)).toEqual([
      { label: 'Admin', value: 'admin' },
      { label: 'Moderator', value: 'moderator' },
    ]);
  });

  test('maps MEMBERS_MARKER to Members option', () => {
    expect(mapRoleIdsToOptions([MEMBERS_MARKER], allRoles)).toEqual([
      MEMBER_ROLE_OPTION,
    ]);
  });

  test('falls back to roleId as label for unknown roles', () => {
    expect(mapRoleIdsToOptions(['unknown-id'], allRoles)).toEqual([
      { label: 'unknown-id', value: 'unknown-id' },
    ]);
  });
});

describe('getChannelPrivacyDefaults', () => {
  test('returns not private with empty arrays for null channel', () => {
    expect(getChannelPrivacyDefaults(null)).toEqual({
      isPrivate: false,
      readers: [],
      writers: [],
    });
  });

  test('returns not private when channel has no reader or writer roles', () => {
    const channel = { readerRoles: [], writerRoles: [] } as any;
    expect(getChannelPrivacyDefaults(channel)).toEqual({
      isPrivate: false,
      readers: [],
      writers: [],
    });
  });

  test('empty readers with writer roles means Members can read (MEMBERS_MARKER)', () => {
    // Backend: empty readers = everyone can read
    // UI: represent this as MEMBERS_MARKER
    const channel = {
      readerRoles: [],
      writerRoles: [{ roleId: 'moderator' }],
    } as any;

    const result = getChannelPrivacyDefaults(channel);
    expect(result.isPrivate).toBe(true);
    expect(result.readers).toContain(MEMBERS_MARKER);
    expect(result.readers).toContain('admin');
  });

  test('empty writers with reader roles means Members can write (MEMBERS_MARKER)', () => {
    const channel = {
      readerRoles: [{ roleId: 'moderator' }],
      writerRoles: [],
    } as any;

    const result = getChannelPrivacyDefaults(channel);
    expect(result.isPrivate).toBe(true);
    expect(result.writers).toContain(MEMBERS_MARKER);
    expect(result.writers).toContain('admin');
  });

  test('preserves existing reader and writer roles', () => {
    const channel = {
      readerRoles: [{ roleId: 'admin' }, { roleId: 'moderator' }],
      writerRoles: [{ roleId: 'admin' }],
    } as any;

    const result = getChannelPrivacyDefaults(channel);
    expect(result.isPrivate).toBe(true);
    expect(result.readers).toEqual(['admin', 'moderator']);
    expect(result.writers).toEqual(['admin']);
  });

  test('ensures admin is always included in readers', () => {
    const channel = {
      readerRoles: [{ roleId: 'moderator' }],
      writerRoles: [{ roleId: 'admin' }],
    } as any;

    const result = getChannelPrivacyDefaults(channel);
    expect(result.readers).toContain('admin');
    expect(result.readers[0]).toBe('admin');
  });

  test('ensures admin is always included in writers', () => {
    const channel = {
      readerRoles: [{ roleId: 'admin' }],
      writerRoles: [{ roleId: 'moderator' }],
    } as any;

    const result = getChannelPrivacyDefaults(channel);
    expect(result.writers).toContain('admin');
    expect(result.writers[0]).toBe('admin');
  });
});
