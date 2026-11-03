import { describe, expect, it } from 'bun:test';

import { CommandError } from './commands/command';
import {
  DEFAULT_INVITE_PROVIDER,
  createInviteProviderClient,
  resolveInviteProviderOrigin,
} from './invite-provider';

const ORIGIN = 'http://localhost:39983';
const TOKEN = '0v1.abcde';

type Recorded = { url: string; init: RequestInit };

function stubFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: Recorded[] = [];
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  }) as typeof fetch;
  return { calls, fetchFn };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function rejection(promise: Promise<unknown>): Promise<CommandError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CommandError);
    return error as CommandError;
  }
  throw new Error('expected a rejection');
}

describe('resolveInviteProviderOrigin', () => {
  it('defaults to the app provider', () => {
    expect(resolveInviteProviderOrigin({})).toBe(DEFAULT_INVITE_PROVIDER);
    expect(DEFAULT_INVITE_PROVIDER).toBe('https://loshut-lonreg.tlon.network');
  });

  it('reduces an override to its origin', () => {
    expect(
      resolveInviteProviderOrigin({
        TLON_INVITE_PROVIDER: 'http://localhost:39983/',
      })
    ).toBe(ORIGIN);
    expect(
      resolveInviteProviderOrigin({
        TLON_INVITE_PROVIDER: 'https://provider.example/some/path?x=1',
      })
    ).toBe('https://provider.example');
  });

  it('rejects non-http(s) and unparseable overrides', () => {
    for (const value of ['ftp://x', 'not a url']) {
      expect(() =>
        resolveInviteProviderOrigin({ TLON_INVITE_PROVIDER: value })
      ).toThrow(`TLON_INVITE_PROVIDER must be an http(s) URL: ${value}`);
    }
  });
});

describe('invite provider metadata', () => {
  it('GETs the token metadata from the configured origin only', async () => {
    const fields = { inviterUserId: '~nec', invitedGroupId: '~zod/test' };
    const { calls, fetchFn } = stubFetch(() => json({ tag: 'x', fields }));
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    expect(await client.getMetadata(TOKEN)).toEqual({ kind: 'found', fields });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORIGIN}/lure/${TOKEN}/metadata`);
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('URI-encodes the token', async () => {
    const { calls, fetchFn } = stubFetch(() => json({}, 404));
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    await client.getMetadata('0v1/../x');
    expect(calls[0].url).toBe(`${ORIGIN}/lure/0v1%2F..%2Fx/metadata`);
  });

  it('keeps the slash of a legacy flag-shaped token, as the app does', async () => {
    const { calls, fetchFn } = stubFetch(() => json({}, 404));
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    expect(await client.getMetadata('~zod/test')).toEqual({
      kind: 'not-found',
    });
    expect(calls[0].url).toBe(`${ORIGIN}/lure/~zod/test/metadata`);
  });

  it('validates and keeps only the fields it reads', async () => {
    for (const [deleted, expected] of [
      [true, true],
      ['true', true],
      [false, undefined],
      ['false', undefined],
      [undefined, undefined],
    ] as const) {
      const { fetchFn } = stubFetch(() =>
        json({
          tag: 'groups-0',
          fields: {
            'bite-type': 2,
            extra: { nested: true },
            inviteType: 'group',
            inviterUserId: '~nec',
            invitedGroupId: '~zod/test',
            invitedGroupTitle: 'Test',
            inviterNickname: 'Nec',
            invitedGroupDeleted: deleted,
          },
        })
      );
      const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

      expect(await client.getMetadata(TOKEN)).toEqual({
        kind: 'found',
        fields: {
          inviteType: 'group',
          inviterUserId: '~nec',
          invitedGroupId: '~zod/test',
          ...(expected === undefined ? {} : { invitedGroupDeleted: expected }),
        },
      });
    }
  });

  it('maps 404 to not-found', async () => {
    const { fetchFn } = stubFetch(
      () => new Response('Token not found', { status: 404 })
    );
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    expect(await client.getMetadata(TOKEN)).toEqual({ kind: 'not-found' });
  });

  it('maps other statuses to an HTTP error', async () => {
    const { fetchFn } = stubFetch(() => new Response('boom', { status: 500 }));
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    const error = await rejection(client.getMetadata(TOKEN));
    expect(error.message).toBe(
      'Invite service returned HTTP 500 for the invite.'
    );
    expect(error.message).not.toContain(TOKEN);
  });

  it('maps a fetch failure to the unreachable error', async () => {
    const fetchFn = (async () => {
      throw new TypeError('connection refused');
    }) as unknown as typeof fetch;
    const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

    const error = await rejection(client.getMetadata(TOKEN));
    expect(error.message).toBe(
      `Could not reach the invite service at ${ORIGIN} (connection refused). Try again later.`
    );
  });

  it('aborts a hung request at the timeout', async () => {
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        );
      })) as unknown as typeof fetch;
    const client = createInviteProviderClient({
      origin: ORIGIN,
      fetchFn,
      timeoutMs: 1,
    });

    const error = await rejection(client.getMetadata(TOKEN));
    expect(error.message).toStartWith(
      `Could not reach the invite service at ${ORIGIN} (`
    );
  });

  it('rejects invalid JSON, missing fields, and mistyped read fields as unusable', async () => {
    const bodies = [
      () => new Response('not json', { status: 200 }),
      () => json({ tag: 'x' }),
      () => json({ fields: ['a'] }),
      () => json({ fields: { inviterUserId: 7 } }),
      () => json({ fields: { invitedGroupId: null } }),
      () =>
        json({ fields: { inviterUserId: '~nec', invitedGroupDeleted: 'yes' } }),
      () => json(null),
    ];
    for (const body of bodies) {
      const { fetchFn } = stubFetch(body);
      const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });
      const error = await rejection(client.getMetadata(TOKEN));
      expect(error.message).toBe(
        'Invite service returned unusable metadata for the invite.'
      );
      expect(error.message).not.toContain(TOKEN);
    }
  });
});

describe('invite provider bite', () => {
  it('POSTs the exact form body %bait expects, with or without a sig', async () => {
    for (const ship of ['~zod', 'zod']) {
      const { calls, fetchFn } = stubFetch(
        () => new Response('<html>sent</html>', { status: 200 })
      );
      const client = createInviteProviderClient({ origin: ORIGIN, fetchFn });

      expect(await client.bite(TOKEN, ship)).toEqual({ kind: 'sent' });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(`${ORIGIN}/lure/${TOKEN}`);
      expect(calls[0].init.method).toBe('POST');
      expect(calls[0].init.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      expect(calls[0].init.body).toBe('ship=%7Ezod');
    }
  });

  it('maps 404 to not-found and other failures to the HTTP error', async () => {
    const notFound = createInviteProviderClient({
      origin: ORIGIN,
      fetchFn: stubFetch(() => new Response('', { status: 404 })).fetchFn,
    });
    expect(await notFound.bite(TOKEN, '~zod')).toEqual({ kind: 'not-found' });

    const failing = createInviteProviderClient({
      origin: ORIGIN,
      fetchFn: stubFetch(() => new Response('', { status: 500 })).fetchFn,
    });
    const error = await rejection(failing.bite(TOKEN, '~zod'));
    expect(error.message).toBe(
      'Invite service returned HTTP 500 for the invite.'
    );
    expect(error.message).not.toContain(TOKEN);
  });
});
