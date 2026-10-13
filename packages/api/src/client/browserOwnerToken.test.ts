import { describe, expect, it } from 'vitest';
import { deriveBrowserOwnerToken } from '../lib/browserOwnerToken';

describe('browser owner proof', () => {
  it('matches the Pioneer domain-separated owner proof', () => {
    expect(deriveBrowserOwnerToken(' ~sampel-palnet ')).toBe(
      'GLg78Mg2R/e6wSEQwrG8lQDLNy0eSx8+4ailEe3vUOg='
    );
    expect(deriveBrowserOwnerToken('sampel-palnet')).not.toBe(
      'gVZNQFl6W2CyyahZsex5HAXb+U2Dmp4uaE2xef+Xlgs='
    );
    expect(deriveBrowserOwnerToken('different-code')).not.toBe(
      deriveBrowserOwnerToken('sampel-palnet')
    );
    expect(() => deriveBrowserOwnerToken(' ~ ')).toThrow('unavailable');
  });
});
