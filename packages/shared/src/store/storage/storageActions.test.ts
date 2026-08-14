import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { performUpload } from './storageActions';
import { hasCustomS3Creds, hasHostingUploadCreds } from './storageUtils';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('../../db', () => ({
  storageConfiguration: { getValue: vi.fn() },
  storageCredentials: { getValue: vi.fn() },
}));

vi.mock('./storageUtils', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    hasHostingUploadCreds: vi.fn().mockReturnValue(false),
    hasCustomS3Creds: vi.fn().mockReturnValue(true),
  };
});

vi.mock('@tloncorp/api', () => ({
  getCurrentUserId: vi.fn().mockReturnValue('~zod'),
  RNFile: class {},
}));

vi.mock('@tloncorp/api/lib/urbit', () => ({
  desig: vi.fn((s: string) => s.replace('~', '')),
}));

vi.mock('@urbit/aura', () => ({
  da: { fromUnix: vi.fn().mockReturnValue(0) },
  render: vi.fn().mockReturnValue('2024.1.1..00.00.00'),
}));

const getSignedUrlMock = vi.mocked(getSignedUrl);
const putObjectCommandMock = vi.mocked(PutObjectCommand);
const configGetValue = vi.mocked(db.storageConfiguration.getValue);
const credsGetValue = vi.mocked(db.storageCredentials.getValue);

const uploadResponses: Array<{ ok: boolean; status: number }> = [];
const fetchMock = vi.fn(async (url: string, _opts?: unknown) => {
  if (String(url).startsWith('blob:')) {
    return {
      ok: true,
      blob: async () => new Blob(['abc'], { type: 'image/png' }),
    };
  }
  return uploadResponses.shift() ?? { ok: true, status: 200 };
});

const CONFIG = {
  service: 'credentials' as const,
  currentBucket: 'bucket',
  region: 'us-east-1',
  publicUrlBase: '',
  buckets: [],
  presignedUrl: '',
};

const CREDS = {
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  endpoint: 's3.example.com',
};

function makeFile() {
  return new File(['abc'], 'x.png', { type: 'image/png' });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  configGetValue.mockResolvedValue(CONFIG as any);
  credsGetValue.mockResolvedValue(CREDS as any);
  vi.mocked(hasHostingUploadCreds).mockReturnValue(false);
  vi.mocked(hasCustomS3Creds).mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  uploadResponses.length = 0;
  fetchMock.mockClear();
  getSignedUrlMock.mockReset();
  putObjectCommandMock.mockClear();
});

describe('performUpload custom-S3 ACL retry (browser path)', () => {
  test('400 retries without ACL; non-DO sends Content-Type only', async () => {
    getSignedUrlMock
      .mockResolvedValueOnce('https://bucket.example.com/first-path?sig=x')
      .mockResolvedValueOnce('https://bucket.example.com/retry-path?sig=y');
    uploadResponses.push({ ok: false, status: 400 }, { ok: true, status: 200 });

    const result = await performUpload(makeFile(), true);

    expect(result).toBe('https://bucket.example.com/retry-path');
    expect(getSignedUrlMock).toHaveBeenCalledTimes(2);

    expect(putObjectCommandMock.mock.calls[0][0]).toHaveProperty(
      'ACL',
      'public-read'
    );
    expect(putObjectCommandMock.mock.calls[1][0]).not.toHaveProperty('ACL');

    const uploadCalls = fetchMock.mock.calls.filter(
      ([url]) => !String(url).startsWith('blob:')
    );
    expect(uploadCalls).toHaveLength(2);
    const firstHeaders = (uploadCalls[0] as any)[1].headers;
    const secondHeaders = (uploadCalls[1] as any)[1].headers;
    expect(firstHeaders).toEqual({ 'Content-Type': 'image/png' });
    expect(secondHeaders).toEqual({ 'Content-Type': 'image/png' });
    expect(firstHeaders).not.toHaveProperty('x-amz-acl');
    expect(firstHeaders).not.toHaveProperty('Cache-Control');
  });

  test('403 does not retry', async () => {
    getSignedUrlMock.mockResolvedValueOnce(
      'https://bucket.example.com/signed?sig=x'
    );
    uploadResponses.push({ ok: false, status: 403 });

    await expect(performUpload(makeFile(), true)).rejects.toThrow(
      'Got bad upload response 403'
    );

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const uploadCalls = fetchMock.mock.calls.filter(
      ([url]) => !String(url).startsWith('blob:')
    );
    expect(uploadCalls).toHaveLength(1);
  });

  test('DO endpoint sends full legacy header set including x-amz-acl', async () => {
    credsGetValue.mockResolvedValue({
      ...CREDS,
      endpoint: 'nyc3.digitaloceanspaces.com',
    } as any);
    getSignedUrlMock.mockResolvedValueOnce(
      'https://bucket.nyc3.digitaloceanspaces.com/signed?sig=x'
    );
    uploadResponses.push({ ok: true, status: 200 });

    await performUpload(makeFile(), true);

    const uploadCalls = fetchMock.mock.calls.filter(
      ([url]) => !String(url).startsWith('blob:')
    );
    const headers = (uploadCalls[0] as any)[1].headers;
    expect(headers).toEqual({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'x-amz-acl': 'public-read',
    });
  });
});
