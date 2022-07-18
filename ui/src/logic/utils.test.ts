// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { whomIsFlag } from './utils';

describe('whomIsFlag', () => {
  it('passes valid flags', () => {
    const flags = [
      '~zod/t',
      '~zod/test',
      '~zod/test-test',
      '~zod/test-',
      '~zod/test1',
      '~marzod/t',
      '~marzod/test',
      '~marzod/test-test',
      '~marzod/test-',
      '~marzod/test1',
      '~wicdev-wisryt/t',
      '~wicdev-wisryt/test',
      '~wicdev-wisryt/test-test',
      '~wicdev-wisryt/test-',
      '~wicdev-wisryt/test1',
      '~mister-dister-dozzod-dozzod/t',
      '~mister-dister-dozzod-dozzod/test',
      '~mister-dister-dozzod-dozzod/test-test',
      '~mister-dister-dozzod-dozzod/test-',
      '~mister-dister-dozzod-dozzod/test1',
    ];

    flags.forEach((f) => expect(whomIsFlag(f)).toEqual(true));
  });

  it('fails invalid flags', () => {
    const flags = [
      '~',
      '~zod/',
      '~/',
      '~zod/1',
      '~zod/1test',
      '~zod/Test',
      '~zod/-',
      '~zod/-test',
      '~sample-planet/test', // invalid patp
    ];

    flags.forEach((f) => expect(whomIsFlag(f)).toEqual(false));
  });
});
