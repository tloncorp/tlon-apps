import { scry } from '@tloncorp/api/client/urbit';
import { afterEach, expect, test, vi } from 'vitest';

import {
  ensureFileExtension,
  getExtensionFromMimeType,
  getMemexUpload,
  getStorageQuota,
} from './storageUtils';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(scry).mockReset();
});

test('storage quota uses the configured Memex endpoint and ship token', async () => {
  vi.stubEnv('TLON_MEMEX_URL', '/apps/groups/__memex/');
  vi.mocked(scry).mockResolvedValue('test-ship-token');
  const quota = { availableBytes: 80, totalBytes: 100, usedBytes: 20 };
  const fetchMock = vi.fn().mockResolvedValue(Response.json(quota));
  vi.stubGlobal('fetch', fetchMock);

  await expect(getStorageQuota()).resolves.toEqual(quota);
  expect(fetchMock).toHaveBeenCalledWith(
    '/apps/groups/__memex/v1/solfer-magfed/storage-info',
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'x-landscape-token': 'test-ship-token',
      }),
    })
  );
});

test('upload authorization uses the configured Memex endpoint', async () => {
  vi.stubEnv('TLON_MEMEX_URL', 'https://memex.test.tlon.systems/');
  vi.mocked(scry).mockResolvedValue('test-ship-token');
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      url: 'https://storage.test/upload',
      filePath: 'https://storage.test/image.png',
    })
  );
  vi.stubGlobal('fetch', fetchMock);

  await expect(
    getMemexUpload({
      contentLength: 3,
      contentType: 'image/png',
      fileName: 'image.png',
    })
  ).resolves.toEqual({
    uploadUrl: 'https://storage.test/upload',
    hostedUrl: 'https://storage.test/image.png',
  });
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://memex.test.tlon.systems/v1/solfer-magfed/upload'
  );
});

test('getExtensionFromMimeType supports quicktime videos', () => {
  expect(getExtensionFromMimeType('video/quicktime')).toBe('.mov');
});

test('ensureFileExtension preserves quicktime extension', () => {
  expect(ensureFileExtension('clip.mov', 'video/quicktime')).toBe('clip.mov');
});

test('ensureFileExtension appends quicktime extension when missing', () => {
  expect(ensureFileExtension('clip', 'video/quicktime')).toBe('clip.mov');
});

test('ensureFileExtension falls back to .jpg when no content type', () => {
  expect(ensureFileExtension('clip')).toBe('clip.jpg');
});

test('ensureFileExtension honors a custom fallback extension', () => {
  expect(ensureFileExtension('clip', undefined, '.mp4')).toBe('clip.mp4');
});

test('ensureFileExtension prefers content type over fallback extension', () => {
  expect(ensureFileExtension('clip', 'video/webm', '.mp4')).toBe('clip.webm');
});
