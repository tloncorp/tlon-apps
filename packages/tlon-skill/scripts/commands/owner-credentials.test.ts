import { describe, expect, it } from 'bun:test';
import * as path from 'path';

import {
  type OwnerCredentialsInput,
  resolveOwnerCredentials,
} from './owner-credentials';

const SKILL_DIR = '/tmp/tlon-skill-dir';
const OPENCLAW_CONFIG = '/tmp/openclaw.json';
const HOME_DIR = '/tmp/owner-home';
const DEFAULT_OPENCLAW_CONFIG = path.join(
  HOME_DIR,
  '.openclaw',
  'openclaw.json'
);

function json(value: unknown): string {
  return JSON.stringify(value);
}

function makeInput(
  options: {
    env?: Record<string, string | undefined>;
    files?: Record<string, string>;
    currentShip?: string | null;
  } = {}
): OwnerCredentialsInput {
  const files = options.files ?? {};
  return {
    env: options.env ?? {},
    fileExists: (filePath) => files[filePath] !== undefined,
    readFile: (filePath) => {
      const value = files[filePath];
      if (value === undefined) {
        throw new Error(`missing file: ${filePath}`);
      }
      return value;
    },
    homeDir: HOME_DIR,
    currentShip: options.currentShip ?? null,
  };
}

function ownerShipFile(ship: string): string {
  return path.join(SKILL_DIR, 'ships', `${ship}.json`);
}

describe('resolveOwnerCredentials', () => {
  it('resolves the OpenClaw shape to ship overrides when the skill-dir file exists', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: { OPENCLAW_CONFIG, TLON_SKILL_DIR: SKILL_DIR },
        files: {
          [OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: '~ten' } },
          }),
          [ownerShipFile('ten')]: json({
            url: 'https://ten.tlon.network',
            ship: '~ten',
            code: 'owner-code',
          }),
        },
      })
    );

    expect(result.kind).toBe('overrides');
    if (result.kind !== 'overrides') return;
    expect(result.ownerShip).toBe('ten');
    expect(result.overrides).toEqual({ kind: 'ship', ship: 'ten' });
  });

  it('discovers ownerShip from the default OpenClaw config path when OPENCLAW_CONFIG is unset', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: { TLON_SKILL_DIR: SKILL_DIR },
        files: {
          [DEFAULT_OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: '~ten' } },
          }),
          [ownerShipFile('ten')]: json({
            url: 'https://ten.tlon.network',
            ship: '~ten',
            code: 'owner-code',
          }),
        },
      })
    );

    expect(result.kind).toBe('overrides');
    if (result.kind !== 'overrides') return;
    expect(result.ownerShip).toBe('ten');
    expect(result.overrides).toEqual({ kind: 'ship', ship: 'ten' });
  });

  it('prefers OPENCLAW_CONFIG over the default config paths', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: {
          OPENCLAW_CONFIG,
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'owner-code',
        },
        files: {
          [OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: '~ten' } },
          }),
          [DEFAULT_OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: '~wrong-owner' } },
          }),
        },
      })
    );

    expect(result.kind).toBe('overrides');
    if (result.kind !== 'overrides') return;
    expect(result.ownerShip).toBe('ten');
  });

  it('falls through to the error when the default config has no ownerShip', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        files: {
          [DEFAULT_OPENCLAW_CONFIG]: json({ channels: { tlon: {} } }),
        },
      })
    );

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('standard config paths');
  });

  it('resolves the Hermes env triple to code overrides', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'owner-code',
        },
      })
    );

    expect(result.kind).toBe('overrides');
    if (result.kind !== 'overrides') return;
    expect(result.ownerShip).toBe('ten');
    expect(result.overrides).toEqual({
      kind: 'code',
      url: 'https://ten.tlon.network',
      ship: 'ten',
      code: 'owner-code',
    });
  });

  it('accepts URBIT_PLANET_CODE and prefers TLON_PLANET_CODE', () => {
    const urbitOnly = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          TLON_OWNER_URL: 'https://ten.tlon.network',
          URBIT_PLANET_CODE: 'urbit-code',
        },
      })
    );

    expect(urbitOnly).toMatchObject({
      kind: 'overrides',
      overrides: { kind: 'code', code: 'urbit-code' },
    });

    const both = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'tlon-code',
          URBIT_PLANET_CODE: 'urbit-code',
        },
      })
    );

    expect(both).toMatchObject({
      kind: 'overrides',
      overrides: { kind: 'code', code: 'tlon-code' },
    });
  });

  it('lets TLON_OWNER_SHIP beat OPENCLAW_CONFIG ownerShip', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          OPENCLAW_CONFIG,
          TLON_SKILL_DIR: SKILL_DIR,
        },
        files: {
          [OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: '~mug' } },
          }),
          [ownerShipFile('ten')]: json({
            url: 'https://ten.tlon.network',
            ship: '~ten',
            code: 'owner-code',
          }),
        },
      })
    );

    expect(result).toMatchObject({
      kind: 'overrides',
      ownerShip: 'ten',
      overrides: { kind: 'ship', ship: 'ten' },
    });
  });

  it('returns self when the owner is the current ship', () => {
    for (const currentShip of ['ten', '~ten']) {
      const result = resolveOwnerCredentials(
        makeInput({
          env: { TLON_OWNER_SHIP: '~ten' },
          currentShip,
        })
      );

      expect(result.kind).toBe('self');
    }
  });

  it('prefers the skill-dir file over the env triple', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          TLON_SKILL_DIR: SKILL_DIR,
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'owner-code',
        },
        files: {
          [ownerShipFile('ten')]: json({
            url: 'https://ten.tlon.network',
            ship: '~ten',
            code: 'owner-code',
          }),
        },
      })
    );

    expect(result).toMatchObject({
      kind: 'overrides',
      overrides: { kind: 'ship', ship: 'ten' },
    });
  });

  it('errors naming the sources when no owner identity exists', () => {
    const result = resolveOwnerCredentials(makeInput());

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('TLON_OWNER_SHIP');
    expect(result.message).toContain('OPENCLAW_CONFIG');
    expect(result.message).toContain('--self');
  });

  it('errors naming the credential sources when the owner has no credentials', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: { TLON_OWNER_SHIP: '~ten', TLON_SKILL_DIR: SKILL_DIR },
      })
    );

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('~ten');
    expect(result.message).toContain(ownerShipFile('ten'));
    expect(result.message).toContain('TLON_OWNER_URL');
    expect(result.message).toContain('--self');
  });

  it('tolerates a malformed OPENCLAW_CONFIG JSON', () => {
    const withoutOwnerEnv = resolveOwnerCredentials(
      makeInput({
        env: { OPENCLAW_CONFIG },
        files: { [OPENCLAW_CONFIG]: 'not json' },
      })
    );

    expect(withoutOwnerEnv.kind).toBe('error');

    const withOwnerEnv = resolveOwnerCredentials(
      makeInput({
        env: {
          TLON_OWNER_SHIP: '~ten',
          OPENCLAW_CONFIG,
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'owner-code',
        },
        files: { [OPENCLAW_CONFIG]: 'not json' },
      })
    );

    expect(withOwnerEnv).toMatchObject({ kind: 'overrides', ownerShip: 'ten' });
  });

  it('tolerates a missing OPENCLAW_CONFIG file and ownerShip-less JSON', () => {
    const missing = resolveOwnerCredentials(
      makeInput({ env: { OPENCLAW_CONFIG: '/tmp/missing.json' } })
    );
    expect(missing.kind).toBe('error');

    const noOwnerShip = resolveOwnerCredentials(
      makeInput({
        env: { OPENCLAW_CONFIG },
        files: { [OPENCLAW_CONFIG]: json({ channels: { tlon: {} } }) },
      })
    );
    expect(noOwnerShip.kind).toBe('error');
  });

  it('normalizes the owner ship name from either source', () => {
    const result = resolveOwnerCredentials(
      makeInput({
        env: {
          OPENCLAW_CONFIG,
          TLON_OWNER_URL: 'https://ten.tlon.network',
          TLON_PLANET_CODE: 'owner-code',
        },
        files: {
          [OPENCLAW_CONFIG]: json({
            channels: { tlon: { ownerShip: 'ten' } },
          }),
        },
      })
    );

    expect(result).toMatchObject({
      kind: 'overrides',
      ownerShip: 'ten',
      overrides: { kind: 'code', ship: 'ten' },
    });
  });
});
