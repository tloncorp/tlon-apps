import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { getGroupMemberCount, pagedMembers } from './groupUtils';

function members(joined: number, invited = 0): db.ChatMember[] {
  return [
    ...Array.from({ length: joined }, (_, i) => ({
      contactId: `~joined-${i}`,
      status: 'joined' as const,
    })),
    ...Array.from({ length: invited }, (_, i) => ({
      contactId: `~invited-${i}`,
      status: 'invited' as const,
    })),
  ] as db.ChatMember[];
}

describe('getGroupMemberCount', () => {
  // init keeps 15 seats of a bigger group until a full sync stores the rest
  it('prefers the seat count over a truncated roster', () => {
    expect(getGroupMemberCount({ memberCount: 21, members: members(15) })).toBe(
      21
    );
  });

  it('counts the joined members it has when no count arrived', () => {
    expect(
      getGroupMemberCount({ memberCount: null, members: members(3, 2) })
    ).toBe(3);
    expect(getGroupMemberCount({ members: members(15) })).toBe(15);
  });

  it('reads an empty group as zero', () => {
    expect(getGroupMemberCount({ memberCount: null })).toBe(0);
  });
});

describe('pagedMembers', () => {
  // ~zod ~nec ~bud ~wes ~sev are 0 1 2 3 4 by @p value
  const roster = [
    { contactId: '~sev', status: 'joined' },
    { contactId: '~nec', status: 'joined' },
    { contactId: '~wes', status: 'joined', roles: [{ roleId: 'admin' }] },
    { contactId: '~zod', status: 'joined' },
    { contactId: '~bud', status: 'invited' },
  ] as db.ChatMember[];
  const ids = (members: db.ChatMember[]) => members.map((m) => m.contactId);

  it('keeps members up to the last loaded ship, in page order', () => {
    expect(
      ids(
        pagedMembers(roster, {
          loadedThrough: '~nec',
          awaitingFirstPage: false,
        })
      )
    ).toEqual(['~zod', '~nec', '~bud', '~wes']);
  });

  it('keeps everyone once every page has loaded', () => {
    expect(
      ids(
        pagedMembers(roster, { loadedThrough: null, awaitingFirstPage: false })
      )
    ).toEqual(['~zod', '~nec', '~bud', '~wes', '~sev']);
  });

  // role holders and invites don't wait on the paged list
  it('holds back plain members until the first page lands', () => {
    expect(
      ids(
        pagedMembers(roster, { loadedThrough: null, awaitingFirstPage: true })
      )
    ).toEqual(['~bud', '~wes']);
  });
});
