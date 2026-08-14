import {
  type LookupFn,
  SsrFBlockedError,
} from 'openclaw/plugin-sdk/ssrf-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticate, isPermanentAuthenticationFailure } from './auth.js';
import { UrbitAuthError, UrbitHttpError, UrbitUrlError } from './errors.js';

const localLookupFn = (async () => [
  { address: '127.0.0.1', family: 4 },
]) as unknown as LookupFn;

const localAuthOptions = (fetchImpl: typeof fetch) => ({
  ssrfPolicy: { allowPrivateNetwork: true },
  lookupFn: localLookupFn,
  fetchImpl,
});

describe('tlon urbit auth ssrf', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks private IPs by default', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const error = await authenticate('http://127.0.0.1:8080', 'code').catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(SsrFBlockedError);
    expect(isPermanentAuthenticationFailure(error)).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('classifies an invalid configured URL as permanent', async () => {
    const mockFetch = vi.fn();

    const error = await authenticate('not a valid URL', 'code', {
      fetchImpl: mockFetch,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(UrbitUrlError);
    expect(isPermanentAuthenticationFailure(error)).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows private IPs when allowPrivateNetwork is enabled', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
      headers: new Headers({
        'set-cookie': 'urbauth-~zod=123; Path=/; HttpOnly',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const cookie = await authenticate('http://127.0.0.1:8080', 'code', {
      ssrfPolicy: { allowPrivateNetwork: true },
      lookupFn: localLookupFn,
    });
    expect(cookie).toContain('urbauth-~zod=123');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('classifies explicit login rejection as a permanent auth error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 403 }));

    const error = await authenticate(
      'http://127.0.0.1:8080',
      'bad-code',
      localAuthOptions(fetchImpl)
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(UrbitAuthError);
    expect(error).toMatchObject({ code: 'auth_failed' });
    expect(isPermanentAuthenticationFailure(error)).toBe(true);
  });

  it('keeps server failures transient', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 503 }));

    const error = await authenticate(
      'http://127.0.0.1:8080',
      'code',
      localAuthOptions(fetchImpl)
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(UrbitHttpError);
    expect(error).toMatchObject({ status: 503 });
    expect(isPermanentAuthenticationFailure(error)).toBe(false);
  });

  it('classifies a successful response without a cookie as permanent', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('ok', { status: 200 }));

    const error = await authenticate(
      'http://127.0.0.1:8080',
      'code',
      localAuthOptions(fetchImpl)
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(UrbitAuthError);
    expect(error).toMatchObject({ code: 'missing_cookie' });
    expect(isPermanentAuthenticationFailure(error)).toBe(true);
  });
});
