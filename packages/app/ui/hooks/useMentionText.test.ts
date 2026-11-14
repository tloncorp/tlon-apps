import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { getMentionText } from './useMentionText';

const contactIndex = {
  '~zod': { id: '~zod', nickname: 'Zod' } as db.Contact,
};

describe('getMentionText', () => {
  test('shows a nickname, else the ship number, for a ship with or without its sig', () => {
    const options = { contactIndex, calmDisableNicknames: false };
    expect(getMentionText('zod', options)).toBe('@Zod');
    expect(getMentionText('~sampel-palnet', options)).toBe('@1.624.961.343');
  });

  test('shows the ship number when Calm hides nicknames', () => {
    expect(
      getMentionText('~zod', { contactIndex, calmDisableNicknames: true })
    ).toBe('@0');
  });

  test("shows a role's title", () => {
    expect(
      getMentionText('admin', {
        contactIndex,
        calmDisableNicknames: false,
        roles: [{ id: 'admin', title: 'Admins' }],
      })
    ).toBe('@Admins');
  });
});
