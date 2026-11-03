import { describe, expect, it } from 'vitest';
import { deriveBrowserOwnerToken } from '../lib/browserOwnerToken';

describe('browser owner proof', () => {
  it('matches the Pioneer domain-separated owner proof', () => {
    expect(deriveBrowserOwnerToken(' ~sampel-palnet ', 1700000000000)).toBe(
      '1700000600.a4SWSpEdvmiShPU8usUIIV8hAeB42u0RQKd9j56KEuw='
    );
    expect(deriveBrowserOwnerToken('sampel-palnet')).not.toBe(
      'gVZNQFl6W2CyyahZsex5HAXb+U2Dmp4uaE2xef+Xlgs='
    );
    expect(deriveBrowserOwnerToken('different-code')).not.toBe(
      deriveBrowserOwnerToken('sampel-palnet')
    );
    expect(deriveBrowserOwnerToken('sampel-palnet', 1700000001000)).not.toBe(
      deriveBrowserOwnerToken('sampel-palnet', 1700000000000)
    );
    expect(() => deriveBrowserOwnerToken(' ~ ')).toThrow('unavailable');
  });
});
