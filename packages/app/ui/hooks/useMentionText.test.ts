import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { getMentionText } from './useMentionText';

const contactIndex = {
  '~zod': { id: '~zod', nickname: 'Zod' } as db.Contact,
};

describe('getMentionText', () => {
  test('shows a nickname, else the pet name, for a ship with or without its sig', () => {
    const options = { contactIndex, calmDisableNicknames: false };
    expect(getMentionText('zod', options)).toBe('@Zod');
    expect(getMentionText('~sampel-palnet', options)).toBe(
      '@brightly.tireless.butter.dhole'
    );
  });

  test('shows the pet name when Calm hides nicknames', () => {
    expect(
      getMentionText('~zod', { contactIndex, calmDisableNicknames: true })
    ).toBe('@aurora');
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
