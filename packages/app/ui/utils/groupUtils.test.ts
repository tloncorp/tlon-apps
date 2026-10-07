import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { getGroupMemberCount } from './groupUtils';

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
