import { expect, test } from 'vitest';

import { formatUserId } from './user';

test.each([
  ['galaxy', '~zod', '@aurora', 'aurora'],
  ['star', '~fabled', '@tender.lion', 'tender lion'],
  [
    'planet',
    '~latter-bolden',
    '@wholly.urbane.ebony.beluga',
    'wholly urbane ebony beluga',
  ],
  [
    'planet moon',
    '~livnex-tarlup-pondus-watbel',
    '@tidy.crane · awash.certain.snow.quoll',
    'tidy crane of awash certain snow quoll',
  ],
  [
    'star moon',
    '~sampel-sampel-dozzod-bacwyd',
    '@curious.elk · worthy.panther',
    'curious elk of worthy panther',
  ],
  [
    'galaxy moon',
    '~sampel-sampel-dozzod-dozzod',
    '@curious.elk · aurora',
    'curious elk of aurora',
  ],
  [
    'comet',
    '~siclec-ramsub-tichul-riptud--dibnet-datryg-fiddep-binzod',
    '@?feather.thimble.banner.anchor',
    'unverified feather thimble banner anchor',
  ],
])('formats a %s as its pet name', (_kind, userId, display, ariaLabel) => {
  expect(formatUserId(userId)).toEqual({ display, ariaLabel });
});

test('returns null for an invalid id', () => {
  expect(formatUserId('~not-a-ship')).toBeNull();
});
