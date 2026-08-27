import { SurfaceBundleRef } from '@tloncorp/api';
import { expect, test, vi } from 'vitest';

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { getOrFetchBundle, sha256Hex } from './bundleCache';

setupDatabaseTestSuite();

async function refFor(content: string): Promise<SurfaceBundleRef> {
  return {
    assetRef: `https://storage.example/${content.length}`,
    sha256: await sha256Hex(content),
    size: content.length,
    shellVersion: 1,
  };
}

function fetcherOf(content: string) {
  return vi.fn().mockResolvedValue(content);
}

test('sha256Hex matches a known vector', async () => {
  // sha256("abc")
  expect(await sha256Hex('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('miss fetches, verifies, stores; hit skips the network', async () => {
  const content = '<html>poll app</html>';
  const ref = await refFor(content);
  const fetcher = fetcherOf(content);

  const first = await getOrFetchBundle(ref, fetcher);
  expect(first).toMatchObject({ status: 'ok', content, fromCache: false });
  expect(fetcher).toHaveBeenCalledTimes(1);

  const second = await getOrFetchBundle(ref, fetcher);
  expect(second).toMatchObject({ status: 'ok', content, fromCache: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('a corrupt cache entry is a miss, not an error', async () => {
  const content = '<html>tracker</html>';
  const ref = await refFor(content);
  await getOrFetchBundle(ref, fetcherOf(content));

  // tamper with the stored bytes under the same key
  await db.insertSurfaceBundle({
    sha256: ref.sha256,
    content: '<html>tampered</html>',
    byteLength: 22,
    at: 1,
    maxTotalBytes: 1024 * 1024,
  });

  const fetcher = fetcherOf(content);
  const result = await getOrFetchBundle(ref, fetcher);
  // refetched and re-verified rather than serving the corrupt entry
  expect(result).toMatchObject({ status: 'ok', content, fromCache: false });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('fetched bytes failing the hash are never stored or returned', async () => {
  const content = '<html>real</html>';
  const ref = await refFor(content);
  const evil = fetcherOf('<html>evil</html>');

  const result = await getOrFetchBundle(ref, evil);
  expect(result).toEqual({ status: 'unavailable', reason: 'hash-mismatch' });
  expect(await db.getSurfaceBundle({ sha256: ref.sha256 })).toBeNull();
});

test('fetch failures degrade to unavailable', async () => {
  const ref = await refFor('<html>x</html>');
  const failing = vi.fn().mockRejectedValue(new Error('storage down'));
  expect(await getOrFetchBundle(ref, failing)).toEqual({
    status: 'unavailable',
    reason: 'fetch-failed',
  });
});

test('oversize fetched bundles are refused before hashing', async () => {
  const big = 'x'.repeat(256 * 1024 + 1);
  const ref = await refFor(big);
  expect(await getOrFetchBundle(ref, fetcherOf(big))).toEqual({
    status: 'unavailable',
    reason: 'oversize',
  });
});

test('LRU eviction respects the byte budget and access order', async () => {
  // three ~40-byte bundles under a 100-byte budget: inserting the third
  // evicts the least recently used
  const contents = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)];
  const refs = await Promise.all(contents.map(refFor));
  let clock = 1000;
  const now = () => ++clock;
  const budget = { maxTotalBytes: 100, now };

  await getOrFetchBundle(refs[0], fetcherOf(contents[0]), budget);
  await getOrFetchBundle(refs[1], fetcherOf(contents[1]), budget);
  // touch bundle 0 so bundle 1 becomes the LRU
  await getOrFetchBundle(refs[0], fetcherOf(contents[0]), budget);

  await getOrFetchBundle(refs[2], fetcherOf(contents[2]), budget);

  expect(await db.getSurfaceBundle({ sha256: refs[1].sha256 })).toBeNull();
  expect(await db.getSurfaceBundle({ sha256: refs[0].sha256 })).not.toBeNull();
  expect(await db.getSurfaceBundle({ sha256: refs[2].sha256 })).not.toBeNull();
  expect(await db.getSurfaceBundleCacheTotalBytes()).toBeLessThanOrEqual(100);
});

test('the just-written bundle is never evicted by its own insert', async () => {
  const content = 'z'.repeat(60);
  const ref = await refFor(content);
  // budget smaller than the bundle itself: everything else would go, but
  // the new entry stays usable
  const result = await getOrFetchBundle(ref, fetcherOf(content), {
    maxTotalBytes: 10,
  });
  expect(result.status).toBe('ok');
  expect(await db.getSurfaceBundle({ sha256: ref.sha256 })).not.toBeNull();
});
