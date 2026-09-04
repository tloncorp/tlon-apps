import { SURFACE_CAPS } from '@tloncorp/api';
import type { SurfaceBundleRef } from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import { fetchBundleText } from './useSurfaceBundle';

vi.mock('@tloncorp/shared', () => ({
  getOrFetchBundle: vi.fn(),
}));

const REF: SurfaceBundleRef = {
  assetRef: 'https://storage.example/bundle',
  sha256: 'a'.repeat(64),
  size: 512,
  shellVersion: 1,
};

/**
 * Minimal Response stand-in whose body is a spy: an over-cap declared length
 * must be refused without the body ever being consumed.
 */
function stubResponse({
  body,
  contentLength,
}: {
  body: string;
  contentLength: string | null;
}) {
  const text = vi.fn().mockResolvedValue(body);
  const response = {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-length' ? contentLength : null,
    },
    text,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  return { text };
}

const OVER_CAP_BODY = 'x'.repeat(SURFACE_CAPS.bundleSize + 1);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('an over-cap Content-Length is refused before the body is read', async () => {
  const { text } = stubResponse({
    body: OVER_CAP_BODY,
    contentLength: String(SURFACE_CAPS.bundleSize + 1),
  });

  await expect(fetchBundleText(REF)).rejects.toThrow('bundle too large');
  // the point of the pre-check: nothing was buffered or decoded
  expect(text).not.toHaveBeenCalled();
});

test('a Content-Length at the cap is allowed through', async () => {
  const body = 'y'.repeat(64);
  const { text } = stubResponse({
    body,
    contentLength: String(SURFACE_CAPS.bundleSize),
  });

  await expect(fetchBundleText(REF)).resolves.toBe(body);
  expect(text).toHaveBeenCalledTimes(1);
});

test('a normal in-cap bundle still fetches', async () => {
  const body = '<html>poll app</html>';
  const { text } = stubResponse({
    body,
    contentLength: String(body.length),
  });

  await expect(fetchBundleText(REF)).resolves.toBe(body);
  expect(text).toHaveBeenCalledTimes(1);
});

// The next two cases are the header layer deliberately NOT rejecting: an
// absent or under-reporting Content-Length passes the pre-check, so the
// oversize bytes reach `getOrFetchBundle`, whose post-buffer measurement is
// the authoritative cap (see bundleCache.test.ts, which asserts that an
// over-cap body — and one whose ref under-reports its size — is refused).

test('an absent Content-Length does not short-circuit; the body reaches the post-buffer check', async () => {
  const { text } = stubResponse({
    body: OVER_CAP_BODY,
    contentLength: null,
  });

  await expect(fetchBundleText(REF)).resolves.toBe(OVER_CAP_BODY);
  expect(text).toHaveBeenCalledTimes(1);
});

test('a non-numeric Content-Length does not short-circuit', async () => {
  const { text } = stubResponse({
    body: OVER_CAP_BODY,
    contentLength: 'not-a-number',
  });

  await expect(fetchBundleText(REF)).resolves.toBe(OVER_CAP_BODY);
  expect(text).toHaveBeenCalledTimes(1);
});

test('a lying under-reporting Content-Length does not short-circuit', async () => {
  const { text } = stubResponse({
    body: OVER_CAP_BODY,
    contentLength: '10',
  });

  await expect(fetchBundleText(REF)).resolves.toBe(OVER_CAP_BODY);
  expect(text).toHaveBeenCalledTimes(1);
});

test('a non-ok response fails before any cap logic', async () => {
  const text = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text,
    })
  );

  await expect(fetchBundleText(REF)).rejects.toThrow(
    'bundle fetch failed: 404'
  );
  expect(text).not.toHaveBeenCalled();
});
