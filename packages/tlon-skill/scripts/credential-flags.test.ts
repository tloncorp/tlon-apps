import { describe, expect, it } from 'bun:test';

import { CredentialFlagError, parseGlobalCliOptions } from './credential-flags';

describe('credential flag parsing', () => {
  it('parses valid credential forms without mutating command args', () => {
    expect(
      parseGlobalCliOptions(['--config', 'ship.json', 'contacts', 'self'])
    ).toEqual({
      args: ['contacts', 'self'],
      verbose: false,
      credentialOverrides: { kind: 'config', configFile: 'ship.json' },
    });

    expect(
      parseGlobalCliOptions([
        '--url',
        'https://zod',
        '--cookie',
        'urbauth-~zod=0v',
        'contacts',
      ])
    ).toEqual({
      args: ['contacts'],
      verbose: false,
      credentialOverrides: {
        kind: 'cookie',
        url: 'https://zod',
        cookie: 'urbauth-~zod=0v',
        ship: undefined,
        code: undefined,
      },
    });

    expect(
      parseGlobalCliOptions([
        '--url',
        'https://zod',
        '--ship',
        '~zod',
        '--code',
        'code',
        'contacts',
      ])
    ).toEqual({
      args: ['contacts'],
      verbose: false,
      credentialOverrides: {
        kind: 'code',
        url: 'https://zod',
        ship: '~zod',
        code: 'code',
      },
    });

    expect(
      parseGlobalCliOptions(['--ship=~zod', '--verbose', 'contacts'])
    ).toEqual({
      args: ['contacts'],
      verbose: true,
      credentialOverrides: { kind: 'ship', ship: '~zod' },
    });
  });

  it('rejects partial or conflicting credential forms', () => {
    for (const args of [
      ['--url', 'https://zod', 'contacts'],
      ['--cookie', 'urbauth-~zod=0v', 'contacts'],
      ['--ship', '~zod', '--code', 'code', 'contacts'],
      ['--url', 'https://zod', '--ship', '~zod', 'contacts'],
      ['--config', 'ship.json', '--cookie', 'urbauth-~zod=0v', 'contacts'],
    ]) {
      expect(() => parseGlobalCliOptions(args)).toThrow(CredentialFlagError);
    }
  });

  it('rejects duplicate, empty, and missing credential flag values', () => {
    expect(() =>
      parseGlobalCliOptions(['--ship', '~zod', '--ship', '~bus', 'contacts'])
    ).toThrow('Duplicate credential flag: --ship');
    expect(() => parseGlobalCliOptions(['--cookie=', 'contacts'])).toThrow(
      'Missing value for --cookie'
    );
    expect(() => parseGlobalCliOptions(['--url'])).toThrow(
      'Missing value for --url'
    );
    expect(() =>
      parseGlobalCliOptions([
        '--url',
        '--cookie',
        'urbauth-~zod=0v',
        'contacts',
      ])
    ).toThrow('Missing value for --url');
    expect(() => parseGlobalCliOptions(['--url', 'contacts', 'self'])).toThrow(
      'Missing value for --url'
    );
  });

  it('leaves credential-like tokens after the command boundary untouched', () => {
    expect(parseGlobalCliOptions(['groups', 'create', '--ship'])).toEqual({
      args: ['groups', 'create', '--ship'],
      verbose: false,
      credentialOverrides: null,
    });

    expect(
      parseGlobalCliOptions([
        '--verbose',
        'channels',
        'create',
        '~host/group',
        '--url',
      ])
    ).toEqual({
      args: ['channels', 'create', '~host/group', '--url'],
      verbose: true,
      credentialOverrides: null,
    });

    expect(
      parseGlobalCliOptions(['contacts', '--config', 'ship.json'])
    ).toEqual({
      args: ['contacts', '--config', 'ship.json'],
      verbose: false,
      credentialOverrides: null,
    });
  });
});
