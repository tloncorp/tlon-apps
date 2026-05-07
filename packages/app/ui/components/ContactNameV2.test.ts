import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { resolveContactNameProps } from './contactNameResolver';

const baseContact: db.Contact = {
  id: '~ravmel-ropdyl',
  nickname: null,
  bio: null,
  color: null,
  avatarImage: null,
  status: null,
  coverImage: null,
};

describe('resolveContactNameProps', () => {
  test('contact with nickname only (COALESCE field) shows nickname in auto mode', () => {
    const contact: db.Contact = {
      ...baseContact,
      id: '~ravmel-ropdyl',
      nickname: 'galen',
    };
    const result = resolveContactNameProps({
      contact,
      contactId: '~ravmel-ropdyl',
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe('galen');
    expect(result.showContactId).toBe(false);
  });

  test('Calm disableNicknames hides nickname in auto mode and shows formatted ID', () => {
    const contact: db.Contact = {
      ...baseContact,
      id: '~ravmel-ropdyl',
      nickname: 'galen',
    };
    const result = resolveContactNameProps({
      contact,
      contactId: '~ravmel-ropdyl',
      mode: 'auto',
      calmDisableNicknames: true,
    });
    expect(result.children).toBe('~ravmel-ropdyl');
    expect(result.showContactId).toBe(true);
  });

  test('no contact + planet ID + expandLongIds=true returns full ID', () => {
    const result = resolveContactNameProps({
      contact: null,
      contactId: '~ravmel-ropdyl',
      expandLongIds: true,
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe('~ravmel-ropdyl');
    expect(result.showContactId).toBe(true);
  });

  test('no contact + comet + expandLongIds=false shortens via citeShip', () => {
    const comet = '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod';
    const result = resolveContactNameProps({
      contact: null,
      contactId: comet,
      expandLongIds: false,
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe('~siclec_binzod');
  });

  test('no contact + comet + expandLongIds=true keeps full comet ID', () => {
    const comet = '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod';
    const result = resolveContactNameProps({
      contact: null,
      contactId: comet,
      expandLongIds: true,
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe(comet);
  });
});
