import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BucketsBrokerError,
  canFallBackFromBucketsBroker,
  grantBucketRead,
  isBucketObjectAlreadyDeleted,
} from './bucketsBroker';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Buckets broker client', () => {
  // The host is pointed at a broker by poke and the client by this variable;
  // they have to move together, so the override has to exist on both sides.
  test('honours TLON_MEMEX_URL, trailing slash and all', async () => {
    vi.stubEnv('TLON_MEMEX_URL', 'https://memex.test.tlon.systems/');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ readUrl: 'https://storage.test/get' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await grantBucketRead('token', '~zod', 'object-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://memex.test.tlon.systems/v2/buckets/objects/object-1/read-grant',
      expect.anything()
    );
  });

  // A read token can stop being the one the broker holds between reading it
  // and using it, because the host rotates on its own timer. That is a stale
  // read, not a permission problem.
  test('read-grant surfaces a refused token as an auth failure the caller can retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'capability_denied',
          message: 'read token is not synchronized or has expired',
          retryable: false,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      grantBucketRead('stale', '~zod', 'object/1', 'x.pdf')
    ).rejects.toMatchObject({
      name: 'BucketsBrokerError',
      status: 403,
      code: 'capability_denied',
    });
  });

  // Omitting it makes every download arrive called "download" -- the broker
  // has no filename of its own to fall back to, only that literal.
  test('read-grant carries the name the file should download as', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ readUrl: 'https://storage.test/x' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await grantBucketRead('cap', '~zod', 'object/1', 'Quarterly report.pdf');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://memex.tlon.network/v2/buckets/objects/object%2F1/read-grant',
      expect.objectContaining({
        body: JSON.stringify({
          host: 'zod',
          displayFilename: 'Quarterly report.pdf',
        }),
      })
    );
  });

  // Object keys contain slashes, so anything naming one in a path has to
  // encode it or the request lands on a different route entirely.
  test('percent-encodes an object key into the request path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ readUrl: 'https://storage.test/get' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await grantBucketRead('token', '~zod', 'bucket/object-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://memex.tlon.network/v2/buckets/objects/bucket%2Fobject-1/read-grant',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('only treats rollout failures as legacy-fallback candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'feature_disabled',
          message: 'Buckets is disabled',
          retryable: false,
        }),
        { status: 404 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const cause = await grantBucketRead('token', '~zod', 'object-1').catch(
      (error: unknown) => error
    );

    expect(cause).toBeInstanceOf(BucketsBrokerError);
    expect(canFallBackFromBucketsBroker(cause)).toBe(true);
    expect(
      canFallBackFromBucketsBroker(
        new BucketsBrokerError(
          'capability denied',
          403,
          'capability_denied',
          false
        )
      )
    ).toBe(false);
  });

  test('only treats the broker missing-object response as an idempotent delete', () => {
    expect(
      isBucketObjectAlreadyDeleted(
        new BucketsBrokerError(
          'object was not found',
          409,
          'invalid_state',
          false
        )
      )
    ).toBe(true);
    expect(
      isBucketObjectAlreadyDeleted(
        new BucketsBrokerError(
          'the capability conflicts with an existing exchange',
          409,
          'invalid_state',
          false
        )
      )
    ).toBe(false);
    expect(
      isBucketObjectAlreadyDeleted(
        new BucketsBrokerError(
          'object was not found',
          403,
          'capability_denied',
          false
        )
      )
    ).toBe(false);
  });
});
