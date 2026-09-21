import { describe, expect, it } from 'bun:test';

import { resolveBrowserOwnerShip } from './browser-owner';

function resolver(
  config: unknown,
  activeShip = '~bot',
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
        activeShip: '~bot',
        env: { TLON_OWNER_SHIP: '  ~ZOD  ' },
        exists: () => {
          throw new Error('must not read OpenClaw config');
        },
      })
    ).toBe('~zod');
  });

  it.each(['', '   ', '~zod/other', 'not a ship'])(
    'rejects invalid harness owner %j',
    (owner) => {
      expect(() =>
        resolveBrowserOwnerShip({
          activeShip: '~bot',
          env: { TLON_OWNER_SHIP: owner },
        })
      ).toThrow('TLON_OWNER_SHIP must name a configured owner');
    }
  );

  it('uses only the owner configured for the active bot', () => {
    expect(
      resolver({
        channels: {
          tlon: { ship: '~bot', ownerShip: '~owner' },
        },
      })()
    ).toBe('~owner');
  });

  it('selects the matching account and inherits its base owner', () => {
    expect(
      resolver(
        {
          channels: {
            tlon: {
              ownerShip: '~owner',
              accounts: {
                first: { ship: '~first-bot' },
                second: { ship: '~second-bot', ownerShip: '~second-owner' },
              },
            },
          },
        },
        '~second-bot'
      )()
    ).toBe('~second-owner');
  });

  it('fails closed when the active bot has no configured owner', () => {
    expect(resolver({ channels: { tlon: { ship: '~bot' } } })).toThrow(
      'OpenClaw has no owner configured for ~bot'
    );
  });

  it('does not use another account owner when the active bot does not match', () => {
    expect(
      resolver(
        {
          channels: {
            tlon: {
              accounts: {
                other: { ship: '~other-bot', ownerShip: '~other-owner' },
              },
            },
          },
        },
        '~bot'
      )
    ).toThrow('OpenClaw has no owner configured for ~bot');
  });
});
