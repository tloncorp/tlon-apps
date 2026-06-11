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

  test('custom S3 creds upload directly', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'credentials', credentials: S3_CREDS });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await uploadFile({ blob, fileName: 'x.png' });
    expect(result.url).toBe('https://bucket.example.com/signed');
  });
});

describe('uploadFile assume-hosted override (TLON_HOSTED)', () => {
  const forced = { hostedDetection: 'assume-hosted' as const };

  test('forces the hosted path on a localhost node (URL says not hosted)', async () => {
    isHostedMock.mockReturnValue(false);
    mockShip({ service: 'presigned-url' });
    mockMemexResponse();

    const result = await uploadFile({ blob, fileName: 'croissant.png', ...forced });

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
