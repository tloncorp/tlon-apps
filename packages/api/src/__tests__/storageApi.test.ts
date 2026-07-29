import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { uploadFile } from '../client/storageApi';
import { getCurrentUserIsHosted, scry } from '../client/urbit';

vi.mock('../client/urbit', () => ({
  scry: vi.fn(),
  subscribe: vi.fn(),
  getCurrentUserId: vi.fn().mockReturnValue('~zod'),
  getCurrentUserIsHosted: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue('https://bucket.example.com/signed?sig=x'),
}));

const scryMock = vi.mocked(scry);
const isHostedMock = vi.mocked(getCurrentUserIsHosted);
const getSignedUrlMock = vi.mocked(getSignedUrl);
const putObjectCommandMock = vi.mocked(PutObjectCommand);
const fetchMock = vi.fn();

const S3_CREDS = {
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  endpoint: 's3.example.com',
};

function mockShip({
  service,
  credentials = null,
  genuine = true,
}: {
  service: 'presigned-url' | 'credentials';
  credentials?: Record<string, string> | null;
  genuine?: boolean;
}) {
  scryMock.mockImplementation(async (params: any) => {
    if (params.app === 'storage' && params.path === '/configuration') {
      return {
        'storage-update': {
          configuration: {
            service,
            currentBucket: 'bucket',
            region: 'us-east-1',
            publicUrlBase: '',
            buckets: [],
            presignedUrl: '',
          },
        },
      };
    }
    if (params.app === 'storage' && params.path === '/credentials') {
      return { 'storage-update': { credentials } };
    }
    if (params.app === 'genuine' && params.path === '/secret') {
      if (!genuine) throw new Error('scry failed: 404');
      return 'genuine-token';
    }
    throw new Error(`unexpected scry ${params.app} ${params.path}`);
  });
}

function genuineScryCount() {
  return scryMock.mock.calls.filter(
    ([params]: any[]) => params.app === 'genuine'
  ).length;
}

function mockMemexResponse() {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).startsWith('https://memex.tlon.network/')) {
      return {
        ok: true,
        json: async () => ({
          url: 'https://presigned-put.example.com/upload-here',
          filePath: 'https://storage.tlon.network/~zod/file.png',
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
}

const blob = {
  type: 'image/png',
  size: 3,
} as unknown as Blob;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  scryMock.mockReset();
  isHostedMock.mockReset();
  putObjectCommandMock.mockClear();
  getSignedUrlMock.mockClear();
});

describe('uploadFile default detection (node-url, unchanged)', () => {
  test('hosted URL + presigned service uses memex', async () => {
    isHostedMock.mockReturnValue(true);
    mockShip({ service: 'presigned-url' });
    mockMemexResponse();

    const result = await uploadFile({ blob });
    expect(result.url).toBe('https://storage.tlon.network/~zod/file.png');
  });

  test('non-hosted URL + presigned service throws the classic error (the localhost gap)', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'presigned-url' });

    await expect(uploadFile({ blob })).rejects.toThrow(
      'No storage credentials configured'
    );
    // never reaches the memex path, so %genuine is never scried
    expect(genuineScryCount()).toBe(0);
  });

  test('non-DO endpoint sends Content-Type and Cache-Control without x-amz-acl', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'credentials', credentials: S3_CREDS });
    const signedUrl = 'https://bucket.example.com/signed?sig=x';
    getSignedUrlMock.mockResolvedValueOnce(signedUrl);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const expectedHeaders = {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    };

    const result = await uploadFile({ blob, fileName: 'x.png' });

    expect(result.url).toBe('https://bucket.example.com/signed');
    expect(getSignedUrlMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        expiresIn: 3600,
        signableHeaders: new Set(Object.keys(expectedHeaders)),
      }
    );
    expect(fetchMock.mock.calls).toEqual([
      [
        signedUrl,
        {
          method: 'PUT',
          body: blob,
          headers: expectedHeaders,
        },
      ],
    ]);
  });

  test('DO endpoint sends x-amz-acl wire header on the ACL attempt', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({
      service: 'credentials',
      credentials: { ...S3_CREDS, endpoint: 'nyc3.digitaloceanspaces.com' },
    });
    const signedUrl = 'https://bucket.nyc3.digitaloceanspaces.com/signed?sig=x';
    getSignedUrlMock.mockResolvedValueOnce(signedUrl);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const expectedHeaders = {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'x-amz-acl': 'public-read',
    };

    const result = await uploadFile({ blob, fileName: 'x.png' });

    expect(result.url).toBe(
      'https://bucket.nyc3.digitaloceanspaces.com/signed'
    );
    expect(getSignedUrlMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        expiresIn: 3600,
        signableHeaders: new Set(Object.keys(expectedHeaders)),
      }
    );
    expect(fetchMock.mock.calls).toEqual([
      [
        signedUrl,
        {
          method: 'PUT',
          body: blob,
          headers: expectedHeaders,
        },
      ],
    ]);
  });
});

describe('uploadFile assume-hosted override (TLON_HOSTING)', () => {
  const forced = { hostedDetection: 'assume-hosted' as const };

  test('forces the hosted path on a localhost node (URL says not hosted)', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'presigned-url' });
    mockMemexResponse();

    const result = await uploadFile({
      blob,
      fileName: 'croissant.png',
      ...forced,
    });

    expect(result.url).toBe('https://storage.tlon.network/~zod/file.png');
    // the override short-circuits URL detection entirely
    expect(isHostedMock).not.toHaveBeenCalled();
  });

  test('treats the node like a real hosted one: custom S3 creds still go to S3', async () => {
    // Forcing hosted only sets the hosted bit; the same %storage config a
    // hosted node would have still decides memex-vs-S3.
    mockShip({ service: 'credentials', credentials: S3_CREDS });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await uploadFile({ blob, ...forced });
    expect(result.url).toBe('https://bucket.example.com/signed');
  });

  test('forced hosted with no %genuine token surfaces the scry failure', async () => {
    mockShip({ service: 'presigned-url', genuine: false });

    await expect(uploadFile({ blob, ...forced })).rejects.toThrow();
  });
});

describe('uploadFile custom-S3 ACL retry', () => {
  function setupCustomS3() {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'credentials', credentials: S3_CREDS });
  }

  test('400 on first attempt retries without ACL', async () => {
    setupCustomS3();
    getSignedUrlMock
      .mockResolvedValueOnce('https://bucket.example.com/first-path?sig=x')
      .mockResolvedValueOnce('https://bucket.example.com/retry-path?sig=y');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await uploadFile({ blob, fileName: 'x.png' });

    expect(result.url).toBe('https://bucket.example.com/retry-path');
    expect(getSignedUrlMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(putObjectCommandMock.mock.calls[0][0]).toHaveProperty(
      'ACL',
      'public-read'
    );
    expect(putObjectCommandMock.mock.calls[1][0]).not.toHaveProperty('ACL');

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-amz-acl');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('x-amz-acl');
  });

  test('403 on first attempt does not retry', async () => {
    setupCustomS3();
    getSignedUrlMock.mockResolvedValueOnce(
      'https://bucket.example.com/signed?sig=x'
    );
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(uploadFile({ blob, fileName: 'x.png' })).rejects.toThrow(
      'Upload failed: 403'
    );

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('500 on first attempt does not retry', async () => {
    setupCustomS3();
    getSignedUrlMock.mockResolvedValueOnce(
      'https://bucket.example.com/signed?sig=x'
    );
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(uploadFile({ blob, fileName: 'x.png' })).rejects.toThrow(
      'Upload failed: 500'
    );

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
