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
    expect(result.children).toBe('4.391.936');
    expect(result.showContactId).toBe(true);
  });

  test('no contact + planet shows the ship number', () => {
    const result = resolveContactNameProps({
      contact: null,
      contactId: '~ravmel-ropdyl',
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe('4.391.936');
    expect(result.showContactId).toBe(true);
  });

  test('no contact + comet shows the full ship number', () => {
    const comet = '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod';
    const result = resolveContactNameProps({
      contact: null,
      contactId: comet,
      mode: 'auto',
      calmDisableNicknames: false,
    });
    expect(result.children).toBe(
      '99.417.968.036.447.043.801.257.469.898.296.590.848'
    );
  });

  // Ship names are wire identifiers and must never reach the screen.
  describe('never shows a ship name', () => {
    const ids = [
      '~zod',
      '~ravmel-ropdyl',
      '~livnex-tarlup-pondus-watbel',
      '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod',
    ];
    const modes = ['auto', 'nickname', 'contactId', 'both'] as const;
    const cases = ids.flatMap((contactId) =>
      modes.flatMap((mode) =>
        [false, true].flatMap((calmDisableNicknames) =>
          [null, 'galen'].map((nickname) => ({
            contactId,
            mode,
            calmDisableNicknames,
            nickname,
          }))
        )
      )
    );

    test.each(cases)(
      '%o',
      ({ contactId, mode, calmDisableNicknames, nickname }) => {
        const result = resolveContactNameProps({
          contact: { ...baseContact, id: contactId, nickname },
          contactId,
          mode,
          calmDisableNicknames,
        });
        expect(result.children).not.toContain('~');
        expect(result['aria-label'] ?? '').not.toContain('~');
      }
    );
  });
});
