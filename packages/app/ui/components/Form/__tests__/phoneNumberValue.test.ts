import { isValidPhoneNumber } from 'libphonenumber-js';
import { describe, expect, it } from 'vitest';

import {
  detectCountryFromInput,
  getCallingCode,
  getFlag,
  toE164,
} from '../phoneNumberValue';

describe('phoneNumberValue', () => {
  it('normalizes a US international number to E.164', () => {
    expect(toE164('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('normalizes a French number (with trunk 0) to E.164', () => {
    const value = toE164('+33 06 12 34 56 78');
    expect(value).toBe('+33612345678');
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it('returns empty string for empty input', () => {
    expect(toE164('')).toBe('');
  });

  it('returns an invalid value for partial input (rejected by validation)', () => {
    expect(isValidPhoneNumber(toE164('+1 415'))).toBe(false);
  });

  it('exposes calling code and flag', () => {
    expect(getCallingCode('GB')).toBe('44');
    expect(getFlag('US')).toBe('🇺🇸');
  });

  describe('detectCountryFromInput', () => {
    it('resolves the NANP territory from just the area code', () => {
      expect(detectCountryFromInput('+1 514')).toBe('CA');
      expect(detectCountryFromInput('+1 416')).toBe('CA');
      expect(detectCountryFromInput('+1 212')).toBe('US');
      expect(detectCountryFromInput('+1 876')).toBe('JM');
    });

    it('keeps resolving correctly once the full number is entered', () => {
      expect(detectCountryFromInput('+1 514 234 5678')).toBe('CA');
      expect(detectCountryFromInput('+1 212 555 0100')).toBe('US');
    });

    it('falls back to the calling-code primary before the area code is complete', () => {
      // +1 with fewer than 3 area-code digits can't disambiguate US vs CA.
      expect(detectCountryFromInput('+1 51')).toBe('US');
      expect(detectCountryFromInput('+1 ')).toBe('US');
    });

    it('resolves non-NANP countries from the calling code', () => {
      expect(detectCountryFromInput('+44 20 7946 0958')).toBe('GB');
      expect(detectCountryFromInput('+33 6 12 34 56 78')).toBe('FR');
    });
  });
});
