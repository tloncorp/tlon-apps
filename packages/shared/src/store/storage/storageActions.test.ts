import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storageConfigurationGetValue: vi.fn(),
  storageCredentialsGetValue: vi.fn(),
  getMemexUpload: vi.fn(),
  hasHostingUploadCreds: vi.fn(),
  hasCustomS3Creds: vi.fn(),
  getCurrentUserId: vi.fn(),
  desig: vi.fn(),
  uploadAsync: vi.fn(),
}));

vi.mock('../../db', () => ({
  storageConfiguration: {
    getValue: mocks.storageConfigurationGetValue,
  },
  storageCredentials: {
    getValue: mocks.storageCredentialsGetValue,
  },
}));

vi.mock('./storageUtils', () => ({
  getExtensionFromMimeType: vi.fn(() => '.jpg'),
  getMemexUpload: mocks.getMemexUpload,
  hasCustomS3Creds: mocks.hasCustomS3Creds,
  hasHostingUploadCreds: mocks.hasHostingUploadCreds,
}));

vi.mock('@tloncorp/api', () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock('@tloncorp/api/urbit', () => ({
  desig: mocks.desig,
}));

vi.mock('expo-file-system', () => ({
  uploadAsync: mocks.uploadAsync,
}));

vi.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
  manipulateAsync: vi.fn(),
}));

import { performUpload } from './storageActions';

describe('performUpload', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mocks.storageConfigurationGetValue.mockResolvedValue({
      service: 'presigned-url',
    });
    mocks.storageCredentialsGetValue.mockResolvedValue({});
    mocks.hasHostingUploadCreds.mockReturnValue(true);
    mocks.hasCustomS3Creds.mockReturnValue(false);
    mocks.getMemexUpload.mockResolvedValue({
      hostedUrl: 'https://cdn.example.com/poster.jpg',
      uploadUrl: 'https://upload.example.com/poster.jpg',
    });
    mocks.getCurrentUserId.mockReturnValue('~zod');
    mocks.desig.mockImplementation((value: string) => value);
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  test('uploads prepared web blobs without re-fetching a local blob uri for PUT', async () => {
    const putFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        input === 'https://upload.example.com/poster.jpg' &&
        init?.method === 'PUT'
      ) {
        return new Response(null, { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    global.fetch = putFetch as typeof global.fetch;

    const result = await performUpload(
      {
        blob: new Blob(['poster-bytes'], { type: 'image/jpeg' }),
        fileName: 'poster.jpg',
        mimeType: 'image/jpeg',
        sourceUri: 'blob:https://example.com/poster',
      },
      true
    );

    expect(result).toBe('https://cdn.example.com/poster.jpg');
    expect(putFetch).toHaveBeenCalledTimes(1);
    expect(putFetch).toHaveBeenNthCalledWith(
      1,
      'https://upload.example.com/poster.jpg',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'Content-Type': 'image/jpeg',
        },
        body: expect.any(Blob),
      })
    );
  });
});
