import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pokeUrbitChannel } from './channel-ops.js';
import { UrbitHttpError } from './errors.js';
import { createHttpPokeApi } from './http-poke.js';
import {
  clearKnownSecrets,
  redactUrbitErrorText,
  registerSecret,
  registerUrbitCookie,
} from './redact.js';
import { UrbitSSEClient } from './sse-client.js';

vi.mock('./fetch.js', () => ({
  urbitFetch: vi.fn(),
}));

vi.mock('./auth.js', () => ({
  authenticate: vi.fn().mockResolvedValue('urbauth-~zod=0v1g.abcde.ijklm'),
}));

const COOKIE = 'urbauth-~zod=0v1g.abcde.ijklm';
const SECRET = '0v1g.abcde.ijklm';

async function mockErrorResponse(body: string) {
  const { urbitFetch } = await import('./fetch.js');
  vi.mocked(urbitFetch).mockResolvedValue({
    response: {
      ok: false,
      status: 500,
      text: () => Promise.resolve(body),
    },
    finalUrl: 'https://example.com',
    release: vi.fn().mockResolvedValue(undefined),
  } as never);
}

describe('urbit error body redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Shape masks are tested without the known-value registry.
    clearKnownSecrets();
  });

  it('masks the session cookie in UrbitHttpError message and bodyText', () => {
    const error = new UrbitHttpError({
      operation: 'Scry',
      status: 500,
      bodyText: `invalid session: ${COOKIE}`,
    });
    expect(error.message).toContain('Scry failed: 500');
    expect(error.message).toContain('invalid session');
    expect(error.message).not.toContain(SECRET);
    expect(error.bodyText).not.toContain(SECRET);
  });

  it.each([
    ['a double-quoted value', `Set-Cookie: urbauth-~zod="${SECRET}"; Path=/`],
    ['a single-quoted value', `urbauth-~zod='${SECRET}'`],
    [
      'an escaped quoted value in JSON',
      JSON.stringify({ h: `urbauth-~zod="${SECRET}"` }),
    ],
    ['a JSON key', JSON.stringify({ 'urbauth-~zod': SECRET })],
    ['a single-quoted key', `{'urbauth-~zod': '${SECRET}'}`],
    ['a Set-Cookie header line', `Set-Cookie: session=${SECRET}; HttpOnly`],
    ['a Cookie header line', `bad request\nCookie: other=${SECRET}\n`],
  ])('masks %s', (_shape, body) => {
    const redacted = redactUrbitErrorText(body);
    expect(redacted).not.toContain(SECRET);
    expect(redacted).toContain('***');
  });

  it.each([
    ['double', `Set-Cookie: other="${SECRET}"; HttpOnly`],
    ['single', `Set-Cookie: other='${SECRET}'; HttpOnly`],
  ])('masks a %s-quoted header value', (_quote, body) => {
    expect(redactUrbitErrorText(body)).toBe('Set-Cookie: ***');
  });

  it('masks a quoted header value inside a JSON string and keeps it parseable', () => {
    const body = JSON.stringify({
      header: `Set-Cookie: other="${SECRET}"; HttpOnly`,
      next: 'kept',
    });
    expect(JSON.parse(redactUrbitErrorText(body))).toEqual({
      header: 'Set-Cookie: ***',
      next: 'kept',
    });
  });

  it('leaves prose that mentions a cookie intact', () => {
    const text = 'Cannot parse cookie: SameSite=None requires Secure';
    expect(redactUrbitErrorText(text)).toBe(text);
  });

  it('masks a Set-Cookie JSON key with a quoted cookie value', () => {
    const body = JSON.stringify({
      'Set-Cookie': `urbauth-~zod="${SECRET}"; HttpOnly`,
    });
    const parsed = JSON.parse(redactUrbitErrorText(body));
    expect(JSON.stringify(parsed)).not.toContain(SECRET);
  });

  it('masks a Set-Cookie header after a status prefix', () => {
    const redacted = redactUrbitErrorText(
      `HTTP 401: Set-Cookie: other="${SECRET}"; HttpOnly`
    );
    expect(redacted).toBe('HTTP 401: Set-Cookie: ***');
  });

  it('leaves a cookie mention after a comma intact', () => {
    const text =
      'Cannot parse the header, cookie: SameSite=None requires Secure';
    expect(redactUrbitErrorText(text)).toBe(text);
  });

  it('keeps a redacted JSON body parseable', () => {
    const body = JSON.stringify({ error: 'denied', 'urbauth-~zod': SECRET });
    expect(JSON.parse(redactUrbitErrorText(body))).toEqual({
      error: 'denied',
      'urbauth-~zod': '***',
    });
  });

  it('masks the session cookie in http poke errors', async () => {
    await mockErrorResponse(`invalid session: ${COOKIE}`);
    const api = await createHttpPokeApi({
      url: 'https://example.com',
      code: 'test-code',
      ship: '~zod',
    });
    const error = await api
      .poke({ app: 'chat', mark: 'chat-action', json: {} })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('Poke failed: 500');
    expect(message).toContain('invalid session');
    expect(message).not.toContain(SECRET);
  });

  it('masks the session cookie in subscribe errors', async () => {
    await mockErrorResponse(JSON.stringify({ cookie: COOKIE }));
    const client = new UrbitSSEClient('https://example.com', COOKIE);
    (client as { isConnected: boolean }).isConnected = true;
    const errors: unknown[] = [];
    await client.subscribe({
      app: 'chat',
      path: '/dm/~zod',
      err: (error) => errors.push(error),
    });
    expect(errors).toHaveLength(1);
    const message = (errors[0] as Error).message;
    expect(message).toContain('Subscribe failed: 500');
    expect(message).not.toContain(SECRET);
  });
});

describe('known secret redaction', () => {
  beforeEach(() => {
    clearKnownSecrets();
    registerUrbitCookie(`${COOKIE}; Path=/; HttpOnly`);
  });

  it.each([
    [
      'a quoted JSON header',
      JSON.stringify({ header: `Set-Cookie: x="${SECRET}"` }),
    ],
    ['a status-prefixed header', `HTTP 401: Set-Cookie: x="${SECRET}"`],
    ['an arbitrary sentence', `the session ${SECRET} has expired`],
  ])('masks a registered cookie value in %s', (_shape, body) => {
    expect(redactUrbitErrorText(body)).not.toContain(SECRET);
  });

  it('leaves unregistered text untouched', () => {
    const text = 'the session 0v9z.other.value has expired';
    expect(redactUrbitErrorText(text)).toBe(text);
  });
});

describe('per-request cookie redaction', () => {
  const BARE_BODY = `session ${SECRET} rejected`;

  function evictRegisteredCookie() {
    clearKnownSecrets();
    new UrbitSSEClient('https://example.com', COOKIE);
    for (let i = 0; i < 70; i++) {
      registerSecret(`filler-secret-${i}`);
    }
    // The registry alone no longer covers the session cookie.
    expect(redactUrbitErrorText(BARE_BODY)).toContain(SECRET);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('masks the request cookie in a channel poke error after eviction', async () => {
    evictRegisteredCookie();
    await mockErrorResponse(BARE_BODY);
    const error = await pokeUrbitChannel(
      {
        baseUrl: 'https://example.com',
        cookie: COOKIE,
        ship: 'zod',
        channelId: 'test',
      },
      { app: 'chat', mark: 'chat-action', json: {}, auditContext: 'test' }
    ).catch((caught: unknown) => caught);
    expect((error as Error).message).toContain('rejected');
    expect((error as Error).message).not.toContain(SECRET);
  });

  it('masks the request cookie in an http poke error after eviction', async () => {
    const api = await createHttpPokeApi({
      url: 'https://example.com',
      code: 'test-code',
      ship: '~zod',
    });
    evictRegisteredCookie();
    await mockErrorResponse(BARE_BODY);
    const error = await api
      .poke({ app: 'chat', mark: 'chat-action', json: {} })
      .catch((caught: unknown) => caught);
    expect((error as Error).message).not.toContain(SECRET);
  });
});

describe('subscribe error redaction across a cookie swap', () => {
  it('masks the cookie that was sent when a reconnect swaps it mid-request', async () => {
    const cookieA = 'urbauth-~zod=0v8.cookie-a-value';
    const cookieB = 'urbauth-~zod=0v8.cookie-b-value';
    clearKnownSecrets();
    const client = new UrbitSSEClient('https://example.com', cookieA);
    (client as { isConnected: boolean }).isConnected = true;

    let resolveBody!: (body: string) => void;
    const { urbitFetch } = await import('./fetch.js');
    vi.mocked(urbitFetch).mockResolvedValue({
      response: {
        ok: false,
        status: 500,
        text: () =>
          new Promise<string>((resolve) => {
            resolveBody = resolve;
          }),
      },
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    } as never);

    const errors: unknown[] = [];
    const subscribed = client.subscribe({
      app: 'chat',
      path: '/dm/~zod',
      err: (error) => errors.push(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    client.updateCookie(cookieB);
    for (let i = 0; i < 70; i++) {
      registerSecret(`filler-secret-${i}`);
    }
    expect(redactUrbitErrorText('0v8.cookie-a-value')).toContain(
      '0v8.cookie-a-value'
    );
    resolveBody('session 0v8.cookie-a-value rejected');
    await subscribed;

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toContain('rejected');
    expect((errors[0] as Error).message).not.toContain('0v8.cookie-a-value');
  });
});
