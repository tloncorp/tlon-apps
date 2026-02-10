import { describe, expect, it, vi } from 'vitest';

import { Urbit } from '../http-api';

describe('Urbit connection', () => {
  it('connects successfully and starts identity hydration requests', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/~/login')) {
        return Promise.resolve(
          new Response(null, {
            status: 204,
            headers: {
              'set-cookie': 'urbauth-~zod=abc123; Path=/; HttpOnly',
            },
          })
        );
      }
      if (url.endsWith('/~/host')) {
        return Promise.resolve(new Response('~zod', { status: 200 }));
      }
      if (url.endsWith('/~/name')) {
        return Promise.resolve(new Response('~zod', { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const client = new Urbit(
      'http://localhost:8080',
      'lidlut-tabwed',
      undefined,
      fetchMock as typeof fetch
    );

    await client.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.cookie).toContain('urbauth-~zod=abc123');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/~/login',
      expect.objectContaining({ method: 'post' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/~/name',
      expect.objectContaining({ method: 'get' })
    );
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith('/~/host'))
    ).toBe(false);
  });

  it('throws on non-2xx login responses', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 401 })));
    const client = new Urbit(
      'http://localhost:8080',
      'bad-code',
      undefined,
      fetchMock as typeof fetch
    );

    await expect(client.connect()).rejects.toThrow('Login failed with status 401');
  });
});
