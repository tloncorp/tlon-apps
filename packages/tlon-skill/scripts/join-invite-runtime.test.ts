import { BadResponseError } from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { __resetApiClientForTests } from './api-client';
import { type JoinInviteDeps, run } from './commands/join-invite';
import {
  createJoinInviteDeps,
  runJoinInviteCommand,
} from './join-invite-runtime';
import {
  mockedGetGroup,
  mockedJoinGroup,
  mockedPoke,
  mockedRequestGroupInvitation,
  mockedScry,
  mockedSubscribe,
  mockedSubscribeOnce,
} from './tloncorp-api-mock';

const FLAG = '~zod/test';
const TOKEN = '0v1.abcde';
const PROVIDER = 'http://localhost:39983';

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
  'TLON_INVITE_PROVIDER',
];

const LOCAL = {
  joinGroupById: async () => {
    throw new Error('unexpected legacy join');
  },
};

const META = { title: 'Test', description: '', image: '', cover: '' };

function preview(privacy: 'public' | 'private' | 'secret') {
  return { flag: FLAG, meta: META, time: 0, 'member-count': 1, privacy };
}

function foreign(overrides: Record<string, unknown> = {}) {
  return {
    invites: [],
    lookup: 'done',
    preview: preview('private'),
    progress: null,
    token: null,
    ...overrides,
  };
}

function invite(valid: boolean) {
  return {
    flag: FLAG,
    time: 0,
    from: '~nec',
    token: null,
    note: null,
    preview: preview('private'),
    valid,
  };
}

const notMember = async () => {
  throw new BadResponseError(404, 'not found');
};

const FOREIGN_PATH = `/v1/foreigns/${FLAG}`;
const GROUP_METADATA = {
  tag: 'groups-0',
  fields: {
    'bite-type': '2',
    inviteType: 'group',
    inviterUserId: '~nec',
    invitedGroupId: FLAG,
  },
};

let savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.TLON_URL = 'https://ten.tlon.network';
  process.env.TLON_SHIP = '~ten';
  process.env.TLON_CODE = 'sampel-ticlyt-migfun-falmel';
  __resetApiClientForTests();
  mockedScry.impl = notMember;
  mockedSubscribe.impl = async () => 0;
  mockedSubscribeOnce.impl = async () => undefined;
  mockedGetGroup.impl = notMember;
  mockedJoinGroup.impl = async () => undefined;
  mockedRequestGroupInvitation.impl = async () => undefined;
  mockedPoke.impl = async () => undefined;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = realFetch;
  __resetApiClientForTests();
});

function recordFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = String(input);
    calls.push({ url, method: init?.method });
    return respond(url, init ?? {});
  }) as typeof fetch;
  return calls;
}

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

describe('join-invite runtime group state', () => {
  it('short-circuits on membership without reading the foreign record', async () => {
    const scries: unknown[] = [];
    mockedGetGroup.impl = async () => ({ currentUserIsMember: true });
    mockedScry.impl = async (...args: unknown[]) => {
      scries.push(args[0]);
      return foreign();
    };

    const read = await createJoinInviteDeps(LOCAL).getGroupState(FLAG);

    expect(read).toEqual({
      ok: true,
      state: {
        member: true,
        haveInvite: false,
        haveRequestedInvite: false,
        privacy: null,
      },
    });
    expect(scries).toEqual([]);
  });

  it('reads invites, requests and privacy from the per-flag foreign record', async () => {
    const scries: unknown[] = [];
    mockedScry.impl = async (...args: unknown[]) => {
      scries.push(args[0]);
      return foreign({ invites: [invite(true)], progress: 'ask' });
    };

    const read = await createJoinInviteDeps(LOCAL).getGroupState(FLAG);

    expect(scries).toEqual([{ app: 'groups', path: FOREIGN_PATH }]);
    expect(read).toEqual({
      ok: true,
      state: {
        member: false,
        haveInvite: true,
        haveRequestedInvite: true,
        privacy: 'private',
      },
    });
  });

  it('ignores revoked invites and reads a preview-less record as unknown privacy', async () => {
    mockedScry.impl = async () =>
      foreign({ invites: [invite(false)], lookup: 'error', preview: null });

    expect(await createJoinInviteDeps(LOCAL).getGroupState(FLAG)).toEqual({
      ok: true,
      state: {
        member: false,
        haveInvite: false,
        haveRequestedInvite: false,
        privacy: null,
      },
    });
  });

  it('reads a 404 from the record scry, wrapped or raw, as no record', async () => {
    for (const error of [
      new BadResponseError(404, 'no scry result'),
      new Response('no scry result', { status: 404 }),
    ]) {
      mockedScry.impl = async () => {
        throw error;
      };

      const read = await createJoinInviteDeps(LOCAL).getGroupState(FLAG);

      expect(read).toEqual({
        ok: true,
        state: {
          member: false,
          haveInvite: false,
          haveRequestedInvite: false,
          privacy: null,
        },
      });
    }
  });

  it('reads a raw 404 Response (the post-reauth retry) as not a member', async () => {
    let foreignsRead = false;
    mockedGetGroup.impl = async () => {
      throw new Response('not found', { status: 404 });
    };
    mockedScry.impl = async () => {
      foreignsRead = true;
      return foreign();
    };

    const read = await createJoinInviteDeps(LOCAL).getGroupState(FLAG);

    expect(foreignsRead).toBe(true);
    expect(read).toMatchObject({
      ok: true,
      state: { member: false, privacy: 'private' },
    });

    mockedGetGroup.impl = async () => {
      throw new Response('denied', { status: 403 });
    };
    foreignsRead = false;
    expect(await createJoinInviteDeps(LOCAL).getGroupState(FLAG)).toMatchObject(
      { ok: false }
    );
    expect(foreignsRead).toBe(false);
  });

  it('reports failed reads instead of folding them into "no record"', async () => {
    for (const error of [
      new Error('foreign scry failed'),
      new BadResponseError(500, 'boom'),
      new Response('denied', { status: 403 }),
    ]) {
      mockedScry.impl = async () => {
        throw error;
      };
      expect(
        await createJoinInviteDeps(LOCAL).getGroupState(FLAG)
      ).toMatchObject({ ok: false });
    }

    let foreignsRead = false;
    mockedGetGroup.impl = async () => {
      throw new BadResponseError(500, 'boom');
    };
    mockedScry.impl = async () => {
      foreignsRead = true;
      return foreign();
    };
    expect(await createJoinInviteDeps(LOCAL).getGroupState(FLAG)).toEqual({
      ok: false,
      error: 'HTTP 500: boom',
    });
    expect(foreignsRead).toBe(false);
  });
});

// The real runtime deps under a fake clock, so a whole run (to the 25s
// deadline) completes instantly. Provider requests go to a stubbed fetch.
async function runOnFakeClock(args: string[]) {
  let now = 0;
  const out: string[] = [];
  const err: string[] = [];
  const deps: JoinInviteDeps = {
    ...createJoinInviteDeps(LOCAL),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    startTimer: () => ({ expired: new Promise(() => {}), cancel: () => {} }),
  };
  const code = await run(args, deps);
  return { code, out: out.join(''), err: err.join('') };
}

describe('join-invite runtime privacy from the foreign record', () => {
  beforeEach(() => {
    process.env.TLON_INVITE_PROVIDER = PROVIDER;
    recordFetch((url) =>
      url.endsWith('/metadata')
        ? Response.json(GROUP_METADATA)
        : new Response('<html>sent</html>', { status: 200 })
    );
  });

  it('previews a group whose stored record has no preview', async () => {
    mockedScry.impl = async () => foreign({ lookup: 'error', preview: null });
    const subscribeCalls: unknown[] = [];
    mockedSubscribeOnce.impl = async (...args: unknown[]) => {
      subscribeCalls.push(args[0]);
      return preview('public');
    };
    const joined: unknown[] = [];
    mockedJoinGroup.impl = async (...args: unknown[]) => {
      joined.push(args[0]);
    };

    const result = await runOnFakeClock(['--invite', TOKEN]);

    expect(subscribeCalls).toEqual([
      { app: 'groups', path: `/gangs/${FLAG}/preview` },
    ]);
    expect(joined).toEqual([FLAG]);
    expect(result.out).toBe(
      `Joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
  });

  it('keeps a known privacy when a later poll reads a preview-less record', async () => {
    let reads = 0;
    mockedScry.impl = async () => {
      reads += 1;
      return reads === 1 ? foreign() : foreign({ preview: null });
    };
    // The fresh preview goes unanswered, as subscribeOnce reports a timeout.
    mockedSubscribeOnce.impl = async () => {
      throw 'timeout';
    };
    const requested: unknown[] = [];
    mockedRequestGroupInvitation.impl = async (...args: unknown[]) => {
      requested.push(args[0]);
    };

    const result = await runOnFakeClock(['--invite', TOKEN]);

    expect(reads).toBeGreaterThan(2);
    expect(requested).toEqual([FLAG]);
    expect(result.out).toContain(`Requested an invite to ${FLAG} instead.`);
  });
});

describe('join-invite runtime preview', () => {
  it('watches the gang preview with an explicit timeout', async () => {
    const subscribeCalls: unknown[] = [];
    mockedSubscribeOnce.impl = async (...args: unknown[]) => {
      subscribeCalls.push(args);
      return preview('public');
    };

    const privacy = await createJoinInviteDeps(LOCAL).getPreviewPrivacy(
      FLAG,
      4_000
    );

    expect(privacy).toBe('public');
    expect(subscribeCalls).toEqual([
      [{ app: 'groups', path: `/gangs/${FLAG}/preview` }, 4_000],
    ]);
  });

  it('reads an empty or malformed answer as unknown', async () => {
    for (const answer of [
      undefined,
      null,
      {},
      { privacy: 'open' },
      { flag: FLAG, meta: META },
    ]) {
      mockedSubscribeOnce.impl = async () => answer;
      expect(
        await createJoinInviteDeps(LOCAL).getPreviewPrivacy(FLAG, 4_000)
      ).toBeNull();
    }
    mockedSubscribeOnce.impl = async () => ({
      flag: FLAG,
      meta: META,
      cordon: { shut: { pending: [], ask: [] } },
      secret: false,
    });
    expect(
      await createJoinInviteDeps(LOCAL).getPreviewPrivacy(FLAG, 4_000)
    ).toBe('private');
  });

  it('reads a never-landing subscription as unknown at the timeout', async () => {
    mockedSubscribeOnce.impl = () => new Promise(() => {});

    const started = Date.now();
    const privacy = await createJoinInviteDeps(LOCAL).getPreviewPrivacy(
      FLAG,
      20
    );

    expect(privacy).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('ignores a subscription that settles after the timeout', async () => {
    for (const settle of ['resolve', 'reject'] as const) {
      let late: (() => void) | undefined;
      mockedSubscribeOnce.impl = () =>
        new Promise((resolve, reject) => {
          late = () =>
            settle === 'resolve' ? resolve(preview('public')) : reject('quit');
        });

      const privacy = await createJoinInviteDeps(LOCAL).getPreviewPrivacy(
        FLAG,
        5
      );
      late?.();
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(privacy).toBeNull();
    }
  });

  it('reads a failed subscription as unknown', async () => {
    mockedSubscribeOnce.impl = async () => {
      throw 'timeout';
    };

    expect(
      await createJoinInviteDeps(LOCAL).getPreviewPrivacy(FLAG, 4_000)
    ).toBeNull();
  });
});

describe('join-invite runtime actions and provider', () => {
  it('maps the group and contact actions onto the api', async () => {
    const seen: unknown[] = [];
    mockedJoinGroup.impl = async (...args: unknown[]) => {
      seen.push(['joinGroup', ...args]);
    };
    mockedRequestGroupInvitation.impl = async (...args: unknown[]) => {
      seen.push(['requestGroupInvitation', ...args]);
    };
    mockedPoke.impl = async (...args: unknown[]) => {
      seen.push(['poke', ...args]);
    };

    const deps = createJoinInviteDeps(LOCAL);
    await deps.joinGroup(FLAG);
    await deps.requestInvite(FLAG);
    await deps.addContact('~nec');

    expect(seen).toEqual([
      ['joinGroup', FLAG],
      ['requestGroupInvitation', FLAG],
      ['poke', { app: 'groups-ui', mark: 'ui-hide-contact', json: '~nec' }],
      [
        'poke',
        {
          app: 'contacts',
          mark: 'contact-action-1',
          json: { page: { kip: '~nec', contact: {} } },
        },
      ],
    ]);
  });

  it('awaits both pokes before the contact add settles', async () => {
    let releaseHide: (() => void) | undefined;
    mockedPoke.impl = (...args: unknown[]) => {
      const { app } = args[0] as { app: string };
      if (app === 'groups-ui') {
        return new Promise<void>((resolve) => {
          releaseHide = resolve;
        });
      }
      return Promise.resolve();
    };

    let settled = false;
    const adding = createJoinInviteDeps(LOCAL)
      .addContact('~nec')
      .then(() => {
        settled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    releaseHide?.();
    await adding;
    expect(settled).toBe(true);
  });

  it('survives a failed suggestion-hide poke without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    mockedPoke.impl = async (...args: unknown[]) => {
      const { app } = args[0] as { app: string };
      if (app === 'groups-ui') throw new Error('hide failed');
    };
    try {
      const { result } = await suppressCliOutput(async () => {
        const outcome = await createJoinInviteDeps(LOCAL).addContact('~nec');
        await new Promise((resolve) => setTimeout(resolve, 10));
        return outcome;
      });
      expect(result).toBeUndefined();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('redeems a personal invite unchanged when the hide poke fails', async () => {
    process.env.TLON_INVITE_PROVIDER = PROVIDER;
    recordFetch(() =>
      Response.json({
        tag: 'groups-0',
        fields: {
          'bite-type': '2',
          inviteType: 'user',
          inviterUserId: '~nec',
          invitedGroupId: '~zod/personal-invite-link',
        },
      })
    );
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    // The hide fails only after the contact poke has succeeded: the report
    // below proves the command waited for it.
    mockedPoke.impl = async (...args: unknown[]) => {
      const { app } = args[0] as { app: string };
      if (app === 'groups-ui') {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error('hide failed');
      }
    };
    const stdoutWrite = process.stdout.write;
    const stderrWrite = process.stderr.write;
    const out: string[] = [];
    const err: string[] = [];
    (process.stdout as any).write = (text: unknown) => out.push(String(text));
    (process.stderr as any).write = (text: unknown) => err.push(String(text));
    let code: number;
    try {
      code = await runJoinInviteCommand(
        ['--invite', `https://invite.tlon.io/${TOKEN}`],
        LOCAL
      );
    } finally {
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
      process.off('unhandledRejection', onUnhandled);
    }

    expect(code).toBe(0);
    expect(out.join('')).toBe(
      'Personal invite from ~nec; added ~nec as a contact.\n'
    );
    expect(err.join('')).toContain(
      'Could not hide ~nec from contact suggestions (hide failed).\n'
    );
    expect(unhandled).toEqual([]);
  });

  it('fails the contact add only when the contact poke fails', async () => {
    mockedPoke.impl = async (...args: unknown[]) => {
      const { app } = args[0] as { app: string };
      if (app === 'contacts') throw new Error('contact poke failed');
    };

    await expect(
      createJoinInviteDeps(LOCAL).addContact('~nec')
    ).rejects.toThrow('contact poke failed');
  });

  it('reads TLON_INVITE_PROVIDER lazily, on the first provider call', async () => {
    process.env.TLON_INVITE_PROVIDER = 'not a url';
    const deps = createJoinInviteDeps(LOCAL);
    process.env.TLON_INVITE_PROVIDER = `${PROVIDER}/`;
    const calls = recordFetch(() => new Response('', { status: 404 }));

    expect(await deps.fetchInviteMetadata(TOKEN)).toEqual({
      kind: 'not-found',
    });
    expect(calls).toEqual([
      { url: `${PROVIDER}/lure/${TOKEN}/metadata`, method: 'GET' },
    ]);
  });

  it('refuses a bare group id without fetching or joining', async () => {
    const calls = recordFetch(() => new Response('', { status: 500 }));
    const joined: string[] = [];

    const { result } = await suppressCliOutput(() =>
      runJoinInviteCommand(['--invite', FLAG], {
        joinGroupById: async (flag) => {
          joined.push(flag);
        },
      })
    );

    expect(result).toBe(1);
    expect(joined).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('joins a legacy flag link only once the provider knows it', async () => {
    process.env.TLON_INVITE_PROVIDER = PROVIDER;
    for (const status of [200, 404]) {
      const calls = recordFetch(() =>
        status === 200
          ? Response.json({ tag: 'groups-0', fields: {} })
          : new Response('', { status })
      );
      const joined: string[] = [];

      const { result } = await suppressCliOutput(() =>
        runJoinInviteCommand(['--invite', `https://invite.tlon.io/${FLAG}`], {
          joinGroupById: async (flag) => {
            joined.push(flag);
          },
        })
      );

      expect(calls).toEqual([
        { url: `${PROVIDER}/lure/${FLAG}/metadata`, method: 'GET' },
      ]);
      expect({ status, result, joined }).toEqual(
        status === 200
          ? { status, result: 0, joined: [FLAG] }
          : { status, result: 1, joined: [] }
      );
    }
  });

  it('sends only the provider requests, to the provider origin, for a pasted link', async () => {
    process.env.TLON_INVITE_PROVIDER = PROVIDER;
    const calls = recordFetch((url) => {
      if (url.endsWith('/metadata')) {
        return Response.json({
          tag: 'groups-0',
          fields: {
            'bite-type': '2',
            inviteType: 'group',
            inviterUserId: '~nec',
            invitedGroupId: FLAG,
          },
        });
      }
      return new Response('<html>sent</html>', { status: 200 });
    });
    const subscriptions: unknown[] = [];
    mockedSubscribe.impl = async (...args: unknown[]) => {
      subscriptions.push(args[0]);
      return 0;
    };
    for (const input of [
      `https://evil.example@invite.tlon.io/${TOKEN}`,
      `https://evil.example/apps/groups/?inviteToken=${TOKEN}`,
      `https://invite.tlon.io@evil.example/?token=${TOKEN}`,
    ]) {
      calls.length = 0;
      __resetApiClientForTests();
      let foreignsReads = 0;
      mockedScry.impl = async () => {
        foreignsReads += 1;
        return foreign(foreignsReads > 1 ? { invites: [invite(true)] } : {});
      };
      const joined: unknown[] = [];
      mockedJoinGroup.impl = async (...args: unknown[]) => {
        joined.push(args[0]);
      };

      const { result, written } = await suppressCliOutput(() =>
        runJoinInviteCommand(['--invite', input, '--self'], LOCAL)
      );

      expect({ input, result }).toEqual({ input, result: 0 });
      expect(calls).toEqual([
        { url: `${PROVIDER}/lure/${TOKEN}/metadata`, method: 'GET' },
        { url: `${PROVIDER}/lure/${TOKEN}`, method: 'POST' },
      ]);
      expect(joined).toEqual([FLAG]);
      expect(written.join('')).toBe(
        `Invite accepted; joining ${FLAG}. Sync may take a moment to show membership.\n`
      );
    }
    // Authentication opens no standing subscription (no /v1/groups, no
    // channels /v4): every request is its own scry, poke or subscribeOnce.
    expect(subscriptions).toEqual([]);
  });
});
