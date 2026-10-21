import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import {
  ensureFileExtension,
  fetchRemoteAsBlobUrl,
  getExtensionFromMimeType,
} from './storageUtils';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

const pngResponse = () =>
  new Response(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]), {
    headers: { 'content-type': 'image/png' },
  });

test('fetchRemoteAsBlobUrl reads the url directly when the host allows it', async () => {
  const fetchMock = vi.fn().mockResolvedValue(pngResponse());
  vi.stubGlobal('fetch', fetchMock);

  const result = await fetchRemoteAsBlobUrl('https://example.com/a.png');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://example.com/a.png');
  expect(result).toMatch(/^blob:/);
});

test('fetchRemoteAsBlobUrl retries through the ship proxy when the direct fetch is blocked', async () => {
  vi.spyOn(api, 'getDumbProxyUrl').mockReturnValue('/apps/groups/~/proxy/0wx');
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(pngResponse());
  vi.stubGlobal('fetch', fetchMock);

  const result = await fetchRemoteAsBlobUrl('https://example.com/a.png');

  expect(fetchMock).toHaveBeenLastCalledWith('/apps/groups/~/proxy/0wx', {
    credentials: 'include',
  });
  expect(result).toMatch(/^blob:/);
});

test('fetchRemoteAsBlobUrl surfaces a failed proxy response', async () => {
  vi.spyOn(api, 'getDumbProxyUrl').mockReturnValue('/apps/groups/~/proxy/0wx');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('nope', { status: 400 }))
  );

  await expect(
    fetchRemoteAsBlobUrl('https://example.com/a.png')
  ).rejects.toThrow('400');
});

test('fetchRemoteAsBlobUrl rejects an empty body from an older proxy', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(new Blob([]), { status: 200 }))
  );

  await expect(
    fetchRemoteAsBlobUrl('https://example.com/a.png')
  ).rejects.toThrow('empty');
});
