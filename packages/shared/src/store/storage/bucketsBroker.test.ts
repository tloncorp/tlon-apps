import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BucketsBrokerError,
  canFallBackFromBucketsBroker,
  completeBucketUpload,
  grantBucketUpload,
} from './bucketsBroker';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Buckets broker client', () => {
  test('exchanges a capability without including the sigil in the host', async () => {
    const grant = {
      objectId: 'object-1',
      requiredHeaders: [['content-type', 'application/pdf']],
      reservationId: 'reservation-1',
      uploadExpiresAt: '2026-08-06T20:00:00Z',
      uploadUrl: 'https://storage.test/upload',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(grant), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      grantBucketUpload('opaque-capability', '~zod')
    ).resolves.toEqual(grant);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://memex.tlon.network/v2/buckets/uploads/grant',
      expect.objectContaining({
        body: JSON.stringify({ host: 'zod' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer opaque-capability',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      })
    );
  });

  test('sends the reservation in both the completion path and body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ objectId: 'object-1' }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await completeBucketUpload('reservation/1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://memex.tlon.network/v2/buckets/uploads/reservation%2F1/complete',
      expect.objectContaining({
        body: JSON.stringify({ reservationId: 'reservation/1' }),
        method: 'POST',
      })
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

    const cause = await grantBucketUpload('opaque-capability', '~zod').catch(
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
});
