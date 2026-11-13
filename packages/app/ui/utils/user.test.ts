import { expect, test } from 'vitest';

import { formatUserId } from './user';

test.each([
  ['galaxy', '~zod', '0'],
  ['star', '~fabled', '30.761'],
  ['planet', '~latter-bolden', '161.352.627'],
  ['planet moon', '~livnex-tarlup-pondus-watbel', '2.602.932.248.757.524.430'],
  ['star moon', '~sampel-sampel-dozzod-bacwyd', '319.478.973.354.536.502'],
  ['galaxy moon', '~sampel-sampel-dozzod-dozzod', '319.478.973.354.475.520'],
  [
    'comet',
    '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod',
    '99.417.968.036.447.043.801.257.469.898.296.590.848',
  ],
])('formats a %s as its number', (_kind, userId, expected) => {
  expect(formatUserId(userId)).toEqual({
    display: expected,
    ariaLabel: expected,
  });
});

test('returns null for an invalid id', () => {
  expect(formatUserId('~not-a-ship')).toBeNull();
});
