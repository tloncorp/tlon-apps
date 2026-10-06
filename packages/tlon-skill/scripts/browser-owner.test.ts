import { describe, expect, it } from 'bun:test';

import { resolveBrowserOwnerShip } from './browser-owner';

function resolver(
  config: unknown,
  activeShip = '~zod',
  configPath = '/config/openclaw.json'
) {
  return () =>
    resolveBrowserOwnerShip({
      activeShip,
      env: { OPENCLAW_CONFIG: configPath },
      homeDir: '/home/test',
      exists: (candidate) => candidate === configPath,
      readFile: () => JSON.stringify(config),
    });
}

describe('browser owner resolution', () => {
  it('uses the harness owner without an OpenClaw configuration file', () => {
    expect(
      resolveBrowserOwnerShip({
        activeShip: '~zod',
        env: { TLON_OWNER_SHIP: '  ~ZOD  ' },
        exists: () => {
          throw new Error('must not read OpenClaw config');
        },
      })
    ).toBe('~zod');
  });

  it.each(['', '   ', '~zod/other', 'not a ship', '~~zod', 'zo~d', '~owner'])(
    'rejects invalid harness owner %j',
    (owner) => {
      expect(() =>
        resolveBrowserOwnerShip({
          activeShip: '~zod',
          env: { TLON_OWNER_SHIP: owner },
        })
      ).toThrow('TLON_OWNER_SHIP must name a configured owner');
    }
  );

  it('uses only the owner configured for the active bot', () => {
    expect(
      resolver({
        channels: {
          tlon: { ship: '~zod', ownerShip: '~nec' },
        },
      })()
    ).toBe('~nec');
  });

  it('normalizes the configured ship and owner', () => {
    expect(
      resolver({
        channels: {
          tlon: { ship: '  ~ZOD  ', ownerShip: '  NEC  ' },
        },
      })()
    ).toBe('~nec');
  });

  it('selects the matching account and inherits its base owner', () => {
    expect(
      resolver(
        {
          channels: {
            tlon: {
              ownerShip: '~nec',
              accounts: {
                first: { ship: '~bud' },
                second: { ship: '~wes', ownerShip: '~sev' },
              },
            },
          },
        },
        '~wes'
      )()
    ).toBe('~sev');
  });

  it('fails closed when the active bot has no configured owner', () => {
    expect(resolver({ channels: { tlon: { ship: '~zod' } } })).toThrow(
      'OpenClaw has no owner configured for ~zod'
    );
  });

  it('does not use another account owner when the active bot does not match', () => {
    expect(
      resolver(
        {
          channels: {
            tlon: {
              accounts: {
                other: { ship: '~bud', ownerShip: '~nec' },
              },
            },
          },
        },
        '~zod'
      )
    ).toThrow('OpenClaw has no owner configured for ~zod');
  });

  it('rejects an invalid active ship instead of matching an account without a ship', () => {
    expect(
      resolver(
        {
          channels: { tlon: { accounts: { missing: { ownerShip: '~nec' } } } },
        },
        '~bot'
      )
    ).toThrow('OpenClaw has no owner configured');
  });
});
