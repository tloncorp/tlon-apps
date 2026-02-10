import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLandscapeAuthCookie } from '../lib/auth';

describe('auth logic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the cookie token from a successful login response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', {
        status: 200,
        headers: {
          'set-cookie': 'urbauth-~zod=abc123; Path=/; HttpOnly',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const cookie = await getLandscapeAuthCookie('http://localhost:8080', 'code');

    expect(cookie).toBe('urbauth-~zod=abc123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on non-2xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getLandscapeAuthCookie('http://localhost:8080', 'bad-code')
    ).rejects.toThrow('Failed to authenticate');
  });
});
