import { afterEach, describe, expect, it, vi } from 'vitest';

import { Urbit } from '../http-api';
import { deriveBrowserOwnerToken } from '../lib/browserOwnerToken';
import {
  getBrowserVaultOwnerAuthorization,
  internalConfigureClient,
  internalRemoveClient,
} from './urbit';

const code = '~sampel-palnet';
function session(fetcher: typeof fetch, getCode = vi.fn()) {
  const client = new Urbit('', undefined, 'groups', (input, init) =>
    String(input).startsWith('/spider/')
      ? fetcher(input, init)
      : Promise.resolve(new Response('', { status: 200 }))
  );
  internalConfigureClient({
    shipName: '~tantec-lidler',
    shipUrl: '',
    client,
    getCode,
  });
  return getCode;
}

afterEach(() => {
  internalRemoveClient();
  vi.restoreAllMocks();
});

describe('browser vault owner authorization', () => {
  it('uses the authenticated ship session without calling Hosting or the code recovery callback', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(code)
    );
    const getCode = session(fetcher);
    expect(await getBrowserVaultOwnerAuthorization()).toEqual({
      planet: 'tantec-lidler',
      ownerToken: deriveBrowserOwnerToken(code),
    });
    expect(getCode).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]).toEqual([
      '/spider/base/json/code/ship',
      expect.objectContaining({ method: 'POST', body: 'null' }),
    ]);
  });

  it('rejects a result after the authenticated account changes', async () => {
    let finish!: (response: Response) => void;
    session(
      async () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    const pending = getBrowserVaultOwnerAuthorization();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    session(async () => Response.json(code));
    finish(Response.json(code));
    await expect(pending).rejects.toThrow();
  });

  it.each([null, {}, '', ' '])(
    'rejects an invalid ship response without returning a proof: %j',
    async (result) => {
      session(async () => Response.json(result));
      await expect(getBrowserVaultOwnerAuthorization()).rejects.toThrow(
        'Owner authentication is unavailable.'
      );
    }
  );

  it('does not fall back to Hosting when the ship session rejects the request', async () => {
    const getCode = session(async () => new Response('', { status: 403 }));
    await expect(getBrowserVaultOwnerAuthorization()).rejects.toThrow();
    expect(getCode).not.toHaveBeenCalled();
  });

  it('requires an authenticated client', async () => {
    internalRemoveClient();
    await expect(getBrowserVaultOwnerAuthorization()).rejects.toThrow(
      'Owner authentication is unavailable.'
    );
  });
});
