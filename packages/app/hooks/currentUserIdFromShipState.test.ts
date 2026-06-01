import { describe, expect, test } from 'vitest';

import { currentUserIdFromShipState } from './currentUserIdFromShipState';

describe('currentUserIdFromShipState', () => {
  test('returns null when both contactId and ship are empty', () => {
    expect(
      currentUserIdFromShipState({ ship: null, contactId: null })
    ).toBeNull();
    expect(
      currentUserIdFromShipState({ ship: undefined, contactId: undefined })
    ).toBeNull();
    expect(currentUserIdFromShipState({ ship: '', contactId: '' })).toBeNull();
  });

  test('returns the sigil-bearing form when contactId is set', () => {
    expect(currentUserIdFromShipState({ ship: null, contactId: 'zod' })).toBe(
      '~zod'
    );
    expect(currentUserIdFromShipState({ ship: null, contactId: '~zod' })).toBe(
      '~zod'
    );
  });

  test('returns the sigil-bearing form when only ship is set', () => {
    expect(currentUserIdFromShipState({ ship: 'zod', contactId: null })).toBe(
      '~zod'
    );
    expect(
      currentUserIdFromShipState({ ship: '~sampel-palnet', contactId: null })
    ).toBe('~sampel-palnet');
  });

  test('prefers contactId over ship when both are present', () => {
    expect(
      currentUserIdFromShipState({ ship: '~zod', contactId: '~sampel-palnet' })
    ).toBe('~sampel-palnet');
  });
});
