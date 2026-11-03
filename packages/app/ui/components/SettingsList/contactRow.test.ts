import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { contactSettingsRow } from './contactRow';

const contact = (fields: Partial<db.Contact>) =>
  ({ id: '~zod', ...fields }) as db.Contact;

describe('contactSettingsRow', () => {
  it('leads with the nickname and puts the ID under it', () => {
    expect(
      contactSettingsRow('~zod', contact({ nickname: 'Zod' }), false)
    ).toEqual({
      key: '~zod',
      title: 'Zod',
      subtitle: '~zod',
      leading: { kind: 'contact', contactId: '~zod' },
    });
  });

  it('shows the ID alone for someone without a nickname', () => {
    const row = contactSettingsRow('~zod', contact({ nickname: '' }), false);
    expect(row.title).toBe('~zod');
    expect(row.subtitle).toBeUndefined();
  });

  it('shows the ID alone for someone not in contacts', () => {
    const row = contactSettingsRow('~zod', undefined, false);
    expect(row.title).toBe('~zod');
    expect(row.subtitle).toBeUndefined();
  });

  it('shows the ID alone when nicknames are turned off', () => {
    const row = contactSettingsRow('~zod', contact({ nickname: 'Zod' }), true);
    expect(row.title).toBe('~zod');
    expect(row.subtitle).toBeUndefined();
  });
});
