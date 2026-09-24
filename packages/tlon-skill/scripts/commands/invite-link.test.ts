import { BadResponseError } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import type { RawGroupForAdminVerification } from './groups-verification';
import {
  INVITE_LINK_HELP,
  IN_FLIGHT_AWAIT_TIMEOUT_MS,
  type InviteLinkDeps,
  MINT_AWAIT_TIMEOUT_MS,
  run,
} from './invite-link';

const FLAG = '~zod/test';
const MINTED_URL = 'https://tlon.network/lure/0vminted';
const VALID_TOKEN_URL = 'https://tlon.network/lure/0vabc.def';
const LEGACY_TOKEN_URL = 'https://tlon.network/lure/~sampel/old-name';
const IN_FLIGHT_NONCE_URL =
  'https://tlon.network/lure/~2026.3.13..12.00.00..1234';

type AwaitOutcome = { ok: true; url: string } | { ok: false; error: unknown };

function publicGroup(
  overrides: Partial<RawGroupForAdminVerification> = {}
): RawGroupForAdminVerification {
  return {
    admins: ['admin'],
    seats: { '~ten': { roles: [] } },
    admissions: { privacy: 'public' },
    ...overrides,
  };
}

function makeDeps(
  options: {
    resolvedShip?: string;
    resolvedShipError?: Error;
    groupPayload?: RawGroupForAdminVerification;
    scryRawGroupError?: unknown;
    idUrl?: string;
    awaitOutcomes?: AwaitOutcome[];
    normalizeImpl?: (url: string) => string | null;
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const sequence: string[] = [];
  const calls = {
    getResolvedShip: 0,
    authenticate: 0,
    scryRawGroup: [] as string[],
    enableGrouper: [] as string[],
    scryIdUrl: [] as string[],
    describe: [] as string[],
    awaitIdLink: [] as Array<{ flag: string; timeoutMs: number }>,
    normalizeInviteLink: [] as string[],
  };

  const deps: InviteLinkDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    getResolvedShip: () => {
      calls.getResolvedShip += 1;
      sequence.push('getResolvedShip');
      if (options.resolvedShipError) throw options.resolvedShipError;
      return options.resolvedShip ?? 'ten';
    },
    authenticate: async () => {
      calls.authenticate += 1;
      sequence.push('authenticate');
    },
    scryRawGroup: async (flag) => {
      calls.scryRawGroup.push(flag);
      sequence.push('scryRawGroup');
      if (options.scryRawGroupError !== undefined) {
        throw options.scryRawGroupError;
      }
      return options.groupPayload ?? publicGroup();
    },
    enableGrouper: async (name) => {
      calls.enableGrouper.push(name);
      sequence.push('enableGrouper');
    },
    scryIdUrl: async (flag) => {
      calls.scryIdUrl.push(flag);
      sequence.push('scryIdUrl');
      return options.idUrl ?? '';
    },
    describe: async (flag) => {
      calls.describe.push(flag);
      sequence.push('describe');
    },
    awaitIdLink: async (flag, timeoutMs) => {
      calls.awaitIdLink.push({ flag, timeoutMs });
      sequence.push('awaitIdLink');
      const outcomes = options.awaitOutcomes ?? [{ ok: true, url: MINTED_URL }];
      const outcome = outcomes[calls.awaitIdLink.length - 1];
      if (!outcome) throw new Error('unexpected awaitIdLink call');
      if (!outcome.ok) throw outcome.error;
      return outcome.url;
    },
    normalizeInviteLink: (url) => {
      calls.normalizeInviteLink.push(url);
      if (options.normalizeImpl) return options.normalizeImpl(url);
      return `https://invite.tlon.io/${url.split('/').pop()}`;
    },
  };

  return {
    deps,
    calls,
    sequence,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

describe('invite-link help and usage', () => {
  it('prints help without authenticating or resolving credentials', async () => {
    for (const arg of ['--help', '-h']) {
      const context = makeDeps();

      const exitCode = await run([arg], context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${INVITE_LINK_HELP}\n`);
      expect(context.stderr()).toBe('');
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.getResolvedShip).toBe(0);
    }
  });

  it('fails missing or malformed flags before auth or credential resolution', async () => {
    const cases: string[][] = [
      [],
      ['not-a-flag'],
      ['host/no-tilde'],
      ['~zod/UPPERCASE'],
      ['~zod'],
      ['~zod/test', 'extra'],
      ['--bogus', FLAG],
    ];

    for (const args of cases) {
      const context = makeDeps();

      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain('Usage: tlon groups invite-link');
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.getResolvedShip).toBe(0);
      expect(context.calls.scryRawGroup).toEqual([]);
    }
  });
});

describe('invite-link retrieval', () => {
  it('prints the canonical URL for an existing 0v token without describing', async () => {
    const context = makeDeps({ idUrl: VALID_TOKEN_URL });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vabc.def\n');
    expect(context.stderr()).toBe(`Invite link for ${FLAG} as ~ten\n`);
    expect(context.calls.describe).toEqual([]);
    expect(context.calls.awaitIdLink).toEqual([]);
    expect(context.calls.enableGrouper).toEqual(['test']);
    expect(context.calls.scryIdUrl).toEqual([FLAG]);
  });

  it('mints when the scry is empty: describe, await, then enable', async () => {
    const context = makeDeps({ idUrl: '' });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vminted\n');
    expect(context.calls.describe).toEqual([FLAG]);
    expect(context.calls.enableGrouper).toEqual(['test']);
    expect(context.calls.awaitIdLink).toEqual([
      { flag: FLAG, timeoutMs: MINT_AWAIT_TIMEOUT_MS },
    ]);
    // Enable comes only after a normalized link is in hand, so failed
    // invocations leave no redemption side effect.
    const describeIdx = context.sequence.indexOf('describe');
    const awaitIdx = context.sequence.indexOf('awaitIdLink');
    const enableIdx = context.sequence.indexOf('enableGrouper');
    expect(describeIdx).toBeLessThan(awaitIdx);
    expect(awaitIdx).toBeLessThan(enableIdx);
  });

  it('does not enable grouper when the mint times out or normalization fails', async () => {
    const timedOut = makeDeps({
      idUrl: '',
      awaitOutcomes: [{ ok: false, error: 'timeout' }],
    });
    expect(await run([FLAG], timedOut.deps)).toBe(1);
    expect(timedOut.calls.enableGrouper).toEqual([]);

    const badUrl = makeDeps({
      idUrl: VALID_TOKEN_URL,
      normalizeImpl: () => null,
    });
    expect(await run([FLAG], badUrl.deps)).toBe(1);
    expect(badUrl.calls.enableGrouper).toEqual([]);
  });

  it('re-mints over a legacy flag-shaped token', async () => {
    const context = makeDeps({ idUrl: LEGACY_TOKEN_URL });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.describe).toEqual([FLAG]);
    expect(context.calls.awaitIdLink).toEqual([
      { flag: FLAG, timeoutMs: MINT_AWAIT_TIMEOUT_MS },
    ]);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vminted\n');
  });

  it('awaits a fresh in-flight nonce without describing', async () => {
    const context = makeDeps({
      idUrl: IN_FLIGHT_NONCE_URL,
      awaitOutcomes: [
        { ok: true, url: 'https://tlon.network/lure/0vinflight' },
      ],
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vinflight\n');
    expect(context.calls.describe).toEqual([]);
    expect(context.calls.awaitIdLink).toEqual([
      { flag: FLAG, timeoutMs: IN_FLIGHT_AWAIT_TIMEOUT_MS },
    ]);
  });

  it('treats a timed-out in-flight nonce as stale and mints once', async () => {
    const context = makeDeps({
      idUrl: IN_FLIGHT_NONCE_URL,
      awaitOutcomes: [
        { ok: false, error: 'timeout' },
        { ok: true, url: 'https://tlon.network/lure/0vfresh' },
      ],
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vfresh\n');
    expect(context.calls.describe).toEqual([FLAG]);
    expect(context.calls.awaitIdLink).toEqual([
      { flag: FLAG, timeoutMs: IN_FLIGHT_AWAIT_TIMEOUT_MS },
      { flag: FLAG, timeoutMs: MINT_AWAIT_TIMEOUT_MS },
    ]);
  });

  it('surfaces an in-flight subscription quit without describing', async () => {
    const context = makeDeps({
      idUrl: IN_FLIGHT_NONCE_URL,
      awaitOutcomes: [{ ok: false, error: 'quit' }],
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('quit');
    expect(context.calls.describe).toEqual([]);
    expect(context.calls.awaitIdLink).toHaveLength(1);
  });

  it('rethrows an in-flight transport failure without describing', async () => {
    const transportError = new Error('channel reset');
    const context = makeDeps({
      idUrl: IN_FLIGHT_NONCE_URL,
      awaitOutcomes: [{ ok: false, error: transportError }],
    });

    await expect(run([FLAG], context.deps)).rejects.toBe(transportError);
    expect(context.stdout()).toBe('');
    expect(context.calls.describe).toEqual([]);
    expect(context.calls.awaitIdLink).toHaveLength(1);
  });

  it('rethrows a mint await transport failure unchanged', async () => {
    const transportError = new Error('sse stream dropped');
    const context = makeDeps({
      idUrl: '',
      awaitOutcomes: [{ ok: false, error: transportError }],
    });

    await expect(run([FLAG], context.deps)).rejects.toBe(transportError);
    expect(context.stdout()).toBe('');
    expect(context.calls.describe).toEqual([FLAG]);
  });

  it('errors when both the in-flight await and the mint time out', async () => {
    const context = makeDeps({
      idUrl: IN_FLIGHT_NONCE_URL,
      awaitOutcomes: [
        { ok: false, error: 'timeout' },
        { ok: false, error: 'timeout' },
      ],
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      'Timed out waiting for the invite service.'
    );
    expect(context.calls.describe).toEqual([FLAG]);
    expect(context.calls.awaitIdLink).toHaveLength(2);
  });

  it('distinguishes mint await timeout from subscription quit', async () => {
    const timeout = makeDeps({
      idUrl: '',
      awaitOutcomes: [{ ok: false, error: 'timeout' }],
    });
    expect(await run([FLAG], timeout.deps)).toBe(1);
    expect(timeout.stderr()).toContain(
      'Timed out waiting for the invite service.'
    );

    const quit = makeDeps({
      idUrl: '',
      awaitOutcomes: [{ ok: false, error: 'quit' }],
    });
    expect(await run([FLAG], quit.deps)).toBe(1);
    expect(quit.stderr()).toContain('quit');
    expect(quit.stderr()).not.toContain(
      'Timed out waiting for the invite service.'
    );
  });
});

describe('invite-link membership and privacy', () => {
  it('maps a 404 group scry to a membership error', async () => {
    const context = makeDeps({
      scryRawGroupError: new BadResponseError(404, 'not found'),
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(`~ten is not a member of ${FLAG}`);
    expect(context.calls.scryIdUrl).toEqual([]);
    expect(context.calls.enableGrouper).toEqual([]);
  });

  it('surfaces statusless and 5xx group scry failures as transport errors', async () => {
    for (const error of [
      new BadResponseError(0, 'connection refused'),
      new BadResponseError(500, 'internal error'),
    ]) {
      const context = makeDeps({ scryRawGroupError: error });

      await expect(run([FLAG], context.deps)).rejects.toBe(error);
      expect(context.stderr()).not.toContain('is not a member');
      expect(context.calls.enableGrouper).toEqual([]);
    }
  });

  it('rejects a non-admin acting ship on a private group', async () => {
    const context = makeDeps({
      groupPayload: publicGroup({ admissions: { privacy: 'private' } }),
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      `~ten is not an admin of ${FLAG} (private)`
    );
    expect(context.stderr()).toContain(
      'invite links from non-admins do not deliver invites'
    );
    expect(context.calls.enableGrouper).toEqual([]);
    expect(context.calls.scryIdUrl).toEqual([]);
  });

  it('rejects a non-admin acting ship on a secret group', async () => {
    const context = makeDeps({
      groupPayload: publicGroup({ admissions: { privacy: 'secret' } }),
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain(
      `~ten is not an admin of ${FLAG} (secret)`
    );
  });

  it('lets an admin acting ship proceed on a private group', async () => {
    const context = makeDeps({
      idUrl: VALID_TOKEN_URL,
      groupPayload: publicGroup({
        admissions: { privacy: 'private' },
        seats: { '~ten': { roles: ['admin'] } },
      }),
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vabc.def\n');
    expect(context.calls.enableGrouper).toEqual(['test']);
  });

  it('lets the host proceed on a private group', async () => {
    const context = makeDeps({
      idUrl: VALID_TOKEN_URL,
      groupPayload: publicGroup({
        admissions: { privacy: 'private' },
        seats: {},
      }),
    });

    const exitCode = await run(['~ten/book-club'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vabc.def\n');
  });

  it('lets a non-admin member proceed on a public group', async () => {
    const context = makeDeps({
      idUrl: VALID_TOKEN_URL,
      groupPayload: publicGroup({ seats: { '~ten': { roles: [] } } }),
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://invite.tlon.io/0vabc.def\n');
  });
});

describe('invite-link credential routing', () => {
  it('acts as whatever ship the resolver returns, before authenticating', async () => {
    const context = makeDeps({ resolvedShip: 'zod', idUrl: VALID_TOKEN_URL });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.getResolvedShip).toBe(1);
    expect(context.stderr()).toBe(`Invite link for ${FLAG} as ~zod\n`);
    const shipIdx = context.sequence.indexOf('getResolvedShip');
    const authIdx = context.sequence.indexOf('authenticate');
    expect(shipIdx).toBeGreaterThanOrEqual(0);
    expect(shipIdx).toBeLessThan(authIdx);
  });

  it('treats --self as a no-op on the current credentials', async () => {
    // Harnesses inject owner credentials for the bare form; --self is how a
    // command string opts out, and the CLI itself must do nothing extra.
    const bare = makeDeps({ resolvedShip: 'zod', idUrl: VALID_TOKEN_URL });
    const selfFlag = makeDeps({ resolvedShip: 'zod', idUrl: VALID_TOKEN_URL });

    expect(await run([FLAG], bare.deps)).toBe(0);
    expect(await run([FLAG, '--self'], selfFlag.deps)).toBe(0);

    expect(selfFlag.stdout()).toBe(bare.stdout());
    expect(selfFlag.stderr()).toBe(bare.stderr());
    expect(selfFlag.sequence).toEqual(bare.sequence);
  });

  it('surfaces a credential resolution failure and never authenticates', async () => {
    const context = makeDeps({
      resolvedShipError: new Error('Missing Urbit config'),
    });

    await expect(run([FLAG], context.deps)).rejects.toThrow(
      'Missing Urbit config'
    );
    expect(context.stdout()).toBe('');
    expect(context.calls.authenticate).toBe(0);
    expect(context.calls.scryRawGroup).toEqual([]);
  });
});

describe('invite-link normalization', () => {
  it('errors without printing when normalization returns null', async () => {
    const context = makeDeps({
      idUrl: VALID_TOKEN_URL,
      normalizeImpl: () => null,
    });

    const exitCode = await run([FLAG], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      `Invite service returned an unrecognized URL: ${VALID_TOKEN_URL}`
    );
  });
});
