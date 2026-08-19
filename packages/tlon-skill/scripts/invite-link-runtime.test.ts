import { BadResponseError } from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  __resetApiClientForTests,
  getCredentialResolution,
} from './api-client';
import {
  INVITE_LINK_DEADLINE_MS,
  createInviteLinkDeps,
  runInviteLinkCommand,
} from './invite-link-runtime';
import {
  mockedCreateInviteLink,
  mockedEnableGroup,
  mockedScry,
  mockedSubscribeOnce,
} from './tloncorp-api-mock';

const FLAG = '~zod/test';

const PUBLIC_GROUP = {
  admins: ['admin'],
  seats: { '~zod': { roles: [] } },
  admissions: { privacy: 'public' },
};

const ENV_KEYS = [
  'TLON_CONFIG_FILE',
  'URBIT_URL',
  'TLON_URL',
  'URBIT_SHIP',
  'TLON_SHIP',
  'URBIT_COOKIE',
  'TLON_COOKIE',
  'URBIT_CODE',
  'TLON_CODE',
  'TLON_SKILL_DIR',
  'TLON_CACHE_DIR',
  'OPENCLAW_CONFIG',
  'TLON_OWNER_SHIP',
  'TLON_OWNER_URL',
  'TLON_PLANET_CODE',
  'URBIT_PLANET_CODE',
];

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.TLON_URL = 'https://zod.tlon.network';
  process.env.TLON_SHIP = '~zod';
  process.env.TLON_CODE = 'sampel-ticlyt-migfun-falmel';
  __resetApiClientForTests();
  mockedScry.impl = async () => undefined;
  mockedSubscribeOnce.impl = async () => undefined;
  mockedCreateInviteLink.impl = async () => undefined;
  mockedEnableGroup.impl = async () => undefined;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  __resetApiClientForTests();
});

async function suppressCliOutput<T>(
  fn: () => Promise<T>
): Promise<{ result: T; written: string[] }> {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  const written: string[] = [];
  (process.stdout as any).write = (text: unknown) => {
    written.push(String(text));
    return true;
  };
  (process.stderr as any).write = () => true;
  try {
    const result = await fn();
    return { result, written };
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
}

describe('invite-link runtime deps wire surface', () => {
  it('scries the exact group and reel id-url paths', async () => {
    const scryCalls: unknown[] = [];
    mockedScry.impl = async (...args: unknown[]) => {
      scryCalls.push(args[0]);
      return '';
    };

    const deps = createInviteLinkDeps();
    await deps.scryRawGroup(FLAG);
    await deps.scryIdUrl(FLAG);

    expect(scryCalls).toEqual([
      { app: 'groups', path: `/v2/ui/groups/${FLAG}` },
      { app: 'reel', path: `/v1/id-url/${FLAG}` },
    ]);
  });

  it('enables grouper with the bare group name', async () => {
    const enableCalls: unknown[] = [];
    mockedEnableGroup.impl = async (...args: unknown[]) => {
      enableCalls.push(args);
    };

    const deps = createInviteLinkDeps();
    await deps.enableGrouper('test');

    expect(enableCalls).toEqual([['test']]);
  });

  it('describes with the minimal groups-0 metadata only', async () => {
    const describeCalls: unknown[] = [];
    mockedCreateInviteLink.impl = async (...args: unknown[]) => {
      describeCalls.push(args);
    };

    const deps = createInviteLinkDeps();
    await deps.describe(FLAG);

    expect(describeCalls).toEqual([
      [FLAG, { tag: 'groups-0', fields: { inviteType: 'group' } }],
    ]);
  });

  it('awaits the id-link subscription with the given path and timeout', async () => {
    const subscribeCalls: unknown[] = [];
    mockedSubscribeOnce.impl = async (...args: unknown[]) => {
      subscribeCalls.push(args);
      return 'https://tlon.network/lure/0vabc';
    };

    const deps = createInviteLinkDeps();
    await deps.awaitIdLink(FLAG, 15_000);

    expect(subscribeCalls).toEqual([
      [{ app: 'reel', path: `/v1/id-link/${FLAG}` }, 15_000],
    ]);
  });

  it('normalizes reel URLs through the canonical invite host', () => {
    const deps = createInviteLinkDeps();

    expect(deps.normalizeInviteLink('https://tlon.network/lure/0vabc')).toBe(
      'https://invite.tlon.io/0vabc'
    );
    expect(deps.normalizeInviteLink('https://example.com/nope')).toBeNull();
  });

  it('rethrows group scry failures raw for the command layer to classify', async () => {
    const notFound = new BadResponseError(404, 'not found');
    mockedScry.impl = async () => {
      throw notFound;
    };

    const deps = createInviteLinkDeps();
    // The identical instance must reach the command layer, carrying the
    // name/status shape its 404-vs-transport classification keys on.
    await expect(deps.scryRawGroup(FLAG)).rejects.toBe(notFound);
    expect(notFound.name).toBe('BadResponseError');
    expect(notFound.status).toBe(404);
  });
});

describe('invite-link runtime deadline', () => {
  it('defaults the global deadline to 25s', () => {
    expect(INVITE_LINK_DEADLINE_MS).toBe(25_000);
  });

  it('completes a --self retrieval within the deadline', async () => {
    mockedScry.impl = async (...args: unknown[]) => {
      const endpoint = args[0] as { app: string; path: string };
      if (endpoint.app === 'groups') return PUBLIC_GROUP;
      return 'https://tlon.network/lure/0vabc';
    };

    const { result, written } = await suppressCliOutput(() =>
      runInviteLinkCommand([FLAG, '--self'], { deadlineMs: 1_000 })
    );

    expect(result).toBe(0);
    expect(written.join('')).toContain('https://invite.tlon.io/0vabc');
  });

  it('rejects when the flow exceeds the deadline', async () => {
    mockedScry.impl = async (...args: unknown[]) => {
      const endpoint = args[0] as { app: string; path: string };
      if (endpoint.app === 'groups') return PUBLIC_GROUP;
      return '';
    };
    mockedSubscribeOnce.impl = () => new Promise(() => {});

    await expect(
      runInviteLinkCommand([FLAG, '--self'], { deadlineMs: 20 })
    ).rejects.toMatchObject({
      message: 'Invite link retrieval timed out after 20ms.',
    });
  });
});

describe('invite-link runtime owner routing', () => {
  it('applies owner overrides by default and acts as the owner ship', async () => {
    // Ambient bot credentials (~zod) are primed by beforeEach; the owner
    // env triple must win without --self, end to end through the real
    // api-client override/resolution lifecycle.
    process.env.TLON_OWNER_SHIP = '~ten';
    process.env.TLON_OWNER_URL = 'https://ten.tlon.network';
    process.env.TLON_PLANET_CODE = 'lapseg-nolmel-riswen-hopryc';

    const scriedAsShips: string[] = [];
    mockedScry.impl = async (...args: unknown[]) => {
      const { app } = args[0] as { app: string };
      scriedAsShips.push(
        getCredentialResolution().config.ship.replace(/^~/, '')
      );
      if (app === 'groups') return PUBLIC_GROUP;
      if (app === 'reel') return 'https://tlon.network/lure/0vowner';
      return undefined;
    };

    const { result, written } = await suppressCliOutput(() =>
      runInviteLinkCommand([FLAG])
    );

    expect(result).toBe(0);
    expect(written.join('')).toBe('https://invite.tlon.io/0vowner\n');
    const resolved = getCredentialResolution();
    expect(resolved.config.ship.replace(/^~/, '')).toBe('ten');
    expect(resolved.config.url).toBe('https://ten.tlon.network');
    expect(new Set(scriedAsShips)).toEqual(new Set(['ten']));
  });
});
