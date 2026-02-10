import { describe, expect, it, vi } from 'vitest';

import { Urbit } from '../http-api';

describe('Urbit.connect', () => {
  it('authenticates on 2xx and stores cookie in node context', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/~/login')) {
        return Promise.resolve(
          new Response('', {
            status: 200,
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
      'lidlut-tabwed-pillex-ridrup',
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
  });

  it('throws on non-2xx login responses', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/~/login')) {
        return Promise.resolve(new Response('', { status: 401 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });

    const client = new Urbit(
      'http://localhost:8080',
      'bad-code',
      undefined,
      fetchMock as typeof fetch
    );

    await expect(client.connect()).rejects.toThrow('Login failed with status 401');
    expect(client.cookie).toBeUndefined();
  });
});
