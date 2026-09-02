import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openclaw/plugin-sdk/ssrf-runtime', () => ({
  fetchWithSsrFGuard: vi.fn(),
}));

vi.mock('openclaw/plugin-sdk/media-runtime', () => ({
  readResponseWithLimit: vi.fn(),
}));

vi.mock('openclaw/plugin-sdk/media-mime', () => ({
  detectMime: vi.fn(),
  extensionForMime: vi.fn(),
  normalizeMimeType: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  uploadFile: vi.fn(),
  scry: vi.fn(),
  getCurrentUserIsHosted: vi.fn(() => false),
}));

vi.mock('./context.js', () => ({
  getDefaultSsrFPolicy: vi.fn(() => ({})),
}));

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
const HTML_BYTES = Buffer.from('<html><body>hi</body></html>');

function mockGuardSuccess(buffer: Buffer, contentType?: string) {
  return {
    response: {
      ok: true,
      headers: new Headers(contentType ? { 'content-type': contentType } : {}),
    } as unknown as Response,
    finalUrl: 'https://example.com/image.png',
    release: vi.fn().mockResolvedValue(undefined),
  };
}

describe('classifyInput', () => {
  let classifyInput: typeof import('./upload.js').classifyInput;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ classifyInput } = await import('./upload.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const localForms = [
    '/pier/foo.png',
    '///pier/foo.png',
    './x.png',
    '../x.png',
    '.\\x.png',
    '..\\x.png',
    '~/x.png',
    'C:\\x.png',
    'C:/x.png',
    'C:foo.png',
    '\\foo.png',
    '\\\\srv\\share\\x.png',
    'file:///pier/foo.png',
    'x:opaque',
  ];

  it.each(localForms)('classifies %s as local', (input) => {
    expect(classifyInput(input)).toEqual({ kind: 'local' });
  });

  it('classifies http:// as http', () => {
    expect(classifyInput('http://host/x.png')).toEqual({ kind: 'http' });
  });

  it('classifies userinfo URLs', () => {
    expect(classifyInput('https://user:pw@host/x')).toEqual({
      kind: 'userinfo',
    });
    expect(classifyInput('https://@host/x')).toEqual({ kind: 'userinfo' });
  });

  it('does NOT classify backslash-path as userinfo', () => {
    const result = classifyInput('https://host\\path@name.png');
    expect(result.kind).toBe('https');
    if (result.kind === 'https') {
      expect(result.canonical).toBe('https://host/path@name.png');
    }
  });

  const invalidForms = [
    'ftp://host/x',
    'data:text/plain,hi',
    'https:foo',
    'https:///foo',
    '//host/path',
    'image.png',
    'dir/image.png',
    'garbage',
  ];

  it.each(invalidForms)('classifies %s as invalid', (input) => {
    expect(classifyInput(input)).toEqual({ kind: 'invalid' });
  });

  it('classifies valid https and returns canonical', () => {
    const result = classifyInput('HTTPS://host/x.png');
    expect(result).toEqual({ kind: 'https', canonical: 'https://host/x.png' });
  });

  it('normalizes MEDIA: prefix', () => {
    const result = classifyInput('MEDIA: https://host/x.png');
    expect(result).toEqual({ kind: 'https', canonical: 'https://host/x.png' });
  });

  it('does not strip media:// prefix', () => {
    expect(classifyInput('media://host/x.png')).toEqual({ kind: 'invalid' });
  });
});

describe('prepareOutboundMedia', () => {
  let prepareOutboundMedia: typeof import('./upload.js').prepareOutboundMedia;
  let mockFetchGuard: ReturnType<typeof vi.fn>;
  let mockReadLimit: ReturnType<typeof vi.fn>;
  let mockDetectMime: ReturnType<typeof vi.fn>;
  let mockExtensionForMime: ReturnType<typeof vi.fn>;
  let mockNormalizeMimeType: ReturnType<typeof vi.fn>;
  let mockUploadFile: ReturnType<typeof vi.fn>;
  let mockScry: ReturnType<typeof vi.fn>;
  let mockIsHosted: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const ssrf = await import('openclaw/plugin-sdk/ssrf-runtime');
    const rlimit = await import('openclaw/plugin-sdk/media-runtime');
    const mime = await import('openclaw/plugin-sdk/media-mime');
    const api = await import('@tloncorp/api');

    mockFetchGuard = vi.mocked(ssrf.fetchWithSsrFGuard);
    mockReadLimit = vi.mocked(rlimit.readResponseWithLimit);
    mockDetectMime = vi.mocked(mime.detectMime);
    mockExtensionForMime = vi.mocked(mime.extensionForMime);
    mockNormalizeMimeType = vi.mocked(mime.normalizeMimeType);
    mockUploadFile = vi.mocked(api.uploadFile);
    mockScry = vi.mocked(api.scry);
    mockIsHosted = vi.mocked(api.getCurrentUserIsHosted);
    mockIsHosted.mockReturnValue(false);

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    ({ prepareOutboundMedia } = await import('./upload.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockImageFetch(buffer = PNG_BYTES, contentType = 'image/png') {
    mockFetchGuard.mockResolvedValue(mockGuardSuccess(buffer, contentType));
    mockReadLimit.mockResolvedValue(buffer);
    mockDetectMime.mockResolvedValue('image/png');
    mockExtensionForMime.mockReturnValue('.png');
    mockNormalizeMimeType.mockReturnValue('image/png');
  }

  function mockNoStorage() {
    mockScry.mockRejectedValue(new Error('no storage'));
  }

  /**
   * A bot moon as actually deployed: reached over localhost/proxy (so not a
   * hosted node by URL), no credentials. Fresh ships bunt `service` to
   * `%credentials`; the mock sets `presigned-url` to model a moon that has
   * been poked by the hosted entrypoint. `uploadFile` would throw for this
   * ship, so we must not call it.
   */
  function mockMoonShaped() {
    mockIsHosted.mockReturnValue(false);
    mockScry.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/credentials') {
        return { 'storage-update': { credentials: {} } };
      }
      return {
        'storage-update': {
          configuration: { service: 'presigned-url', currentBucket: '' },
        },
      };
    });
  }

  /** A genuinely hosted ship with no custom S3: `uploadFile` routes to Memex. */
  function mockHostedPresigned() {
    mockIsHosted.mockReturnValue(true);
    mockScry.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/credentials') {
        return { 'storage-update': { credentials: {} } };
      }
      return {
        'storage-update': {
          configuration: { service: 'presigned-url', currentBucket: '' },
        },
      };
    });
  }

  function mockS3Capable() {
    mockScry.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/credentials') {
        return {
          'storage-update': {
            credentials: {
              accessKeyId: 'ak',
              endpoint: 'https://s3.example.com',
              secretAccessKey: 'sk',
            },
          },
        };
      }
      return {
        'storage-update': {
          configuration: { currentBucket: 'my-bucket' },
        },
      };
    });
  }

  describe('local path rejection (no fetch attempted)', () => {
    const localForms = [
      '/pier/foo.png',
      '///pier/foo.png',
      './x.png',
      '../x.png',
      '.\\x.png',
      '..\\x.png',
      '~/x.png',
      'C:\\x.png',
      'C:/x.png',
      'C:foo.png',
      '\\foo.png',
      '\\\\srv\\share\\x.png',
      'file:///pier/foo.png',
      'x:opaque',
    ];

    it.each(localForms)(
      'throws LOCAL_MEDIA_ERROR for %s without fetching',
      async (input) => {
        await expect(prepareOutboundMedia(input)).rejects.toThrow(
          'Local file paths are not supported on this channel — upload the file first (e.g. `tlon upload <path>`) and resend with the returned https URL.'
        );
        expect(mockFetchGuard).not.toHaveBeenCalled();
      }
    );
  });

  describe('http rejection', () => {
    it('throws https-only error', async () => {
      await expect(prepareOutboundMedia('http://host/x.png')).rejects.toThrow(
        'Only https media URLs are supported.'
      );
      expect(mockFetchGuard).not.toHaveBeenCalled();
    });
  });

  describe('userinfo rejection', () => {
    it('throws for user:pw@host', async () => {
      await expect(
        prepareOutboundMedia('https://user:pw@host/x')
      ).rejects.toThrow(
        'Media URLs with embedded credentials are not supported.'
      );
      expect(mockFetchGuard).not.toHaveBeenCalled();
    });

    it('throws for empty userinfo @host', async () => {
      await expect(prepareOutboundMedia('https://@host/x')).rejects.toThrow(
        'Media URLs with embedded credentials are not supported.'
      );
      expect(mockFetchGuard).not.toHaveBeenCalled();
    });
  });

  describe('invalid input rejection', () => {
    const invalidForms = [
      'ftp://host/x',
      'data:text/plain,hi',
      'https:foo',
      'https:///foo',
      '//host/path',
      'image.png',
      'dir/image.png',
      'garbage',
    ];

    it.each(invalidForms)('throws INVALID for %s', async (input) => {
      await expect(prepareOutboundMedia(input)).rejects.toThrow(
        'Invalid media URL — pass a public https URL. If this is a local file, upload it first (e.g. `tlon upload <path>`) and resend with the returned https URL.'
      );
      expect(mockFetchGuard).not.toHaveBeenCalled();
    });
  });

  describe('leak safety', () => {
    it('thrown messages never contain the input string', async () => {
      const secret = 'X-Goog-Signature=abc123secret';
      const input = `/pier/secret-${secret}.png`;
      try {
        await prepareOutboundMedia(input);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).not.toContain(secret);
        expect((err as Error).message).not.toContain(input);
      }
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).not.toContain(secret);
    });

    it('fetch failure does not leak raw error text', async () => {
      const secretMsg = 'ECONNREFUSED 10.0.0.1:443 secret-token-xyz';
      mockFetchGuard.mockRejectedValue(new Error(secretMsg));
      try {
        await prepareOutboundMedia('https://host/x.png');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toBe(
          'Could not fetch media from the provided URL.'
        );
        expect((err as Error).message).not.toContain(secretMsg);
        expect((err as Error).message).not.toContain('secret-token-xyz');
      }
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).not.toContain(secretMsg);
    });

    it('signed-query URL input not leaked in diagnostics', async () => {
      const secret = 'X-Goog-Signature=deadbeef';
      mockFetchGuard.mockRejectedValue(new Error('network failure'));
      try {
        await prepareOutboundMedia(`https://host/x.png?${secret}`);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).not.toContain(secret);
      }
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).not.toContain(secret);
    });

    it('signed-query URL not leaked through successful fetch + upload rejection', async () => {
      const secret = 'SECRETSIG123';
      const url = `https://host/x.png?X-Goog-Signature=${secret}`;
      mockImageFetch();
      mockS3Capable();
      mockUploadFile.mockRejectedValue(new Error('upload exploded'));

      const result = await prepareOutboundMedia(url);
      expect(result.url).toBe('https://host/x.png?X-Goog-Signature=' + secret);

      const allLogArgs = logSpy.mock.calls.flat().join(' ');
      expect(allLogArgs).not.toContain(secret);
    });

    it('signed-query URL not leaked through successful fetch + non-postable result', async () => {
      const secret = 'SECRETSIG123';
      const url = `https://host/x.png?X-Goog-Signature=${secret}`;
      mockImageFetch();
      mockS3Capable();
      mockUploadFile.mockResolvedValue({ url: 'http://bad.example.com/f.png' });

      const result = await prepareOutboundMedia(url);
      expect(result.url).toBe('https://host/x.png?X-Goog-Signature=' + secret);

      const allLogArgs = logSpy.mock.calls.flat().join(' ');
      expect(allLogArgs).not.toContain(secret);
    });
  });

  describe('guard invocation', () => {
    it('passes requireHttps: true and the 30s timeout signal', async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
      mockImageFetch();
      mockNoStorage();
      await prepareOutboundMedia('https://example.com/image.png');

      expect(timeoutSpy).toHaveBeenCalledWith(30000);
      expect(mockFetchGuard).toHaveBeenCalledWith(
        expect.objectContaining({ requireHttps: true })
      );
      const deadlineSignal = timeoutSpy.mock.results[0]?.value as AbortSignal;
      const guardArg = mockFetchGuard.mock.calls[0][0] as {
        signal?: AbortSignal;
      };
      expect(guardArg.signal).toBe(deadlineSignal);
    });
  });

  describe('fetch failures', () => {
    it('non-2xx throws fixed phrase', async () => {
      mockFetchGuard.mockResolvedValue({
        response: { ok: false, status: 404, headers: new Headers() },
        finalUrl: 'https://example.com/x.png',
        release: vi.fn().mockResolvedValue(undefined),
      });
      await expect(
        prepareOutboundMedia('https://example.com/x.png')
      ).rejects.toThrow('Could not fetch media from the provided URL.');
    });

    it('finalUrl http:// throws fixed phrase', async () => {
      mockFetchGuard.mockResolvedValue({
        response: { ok: true, headers: new Headers() },
        finalUrl: 'http://example.com/x.png',
        release: vi.fn().mockResolvedValue(undefined),
      });
      await expect(
        prepareOutboundMedia('https://example.com/x.png')
      ).rejects.toThrow('Could not fetch media from the provided URL.');
    });

    it('byte-cap overflow throws fixed phrase', async () => {
      const guard = mockGuardSuccess(PNG_BYTES);
      mockFetchGuard.mockResolvedValue(guard);
      mockReadLimit.mockRejectedValue(new Error('overflow 999 MiB'));
      await expect(
        prepareOutboundMedia('https://example.com/x.png')
      ).rejects.toThrow('Could not fetch media from the provided URL.');
      expect(mockReadLimit).toHaveBeenCalledWith(
        guard.response,
        10 * 1024 * 1024
      );
    });

    it('release() called on every path after guard resolves', async () => {
      const release = vi.fn().mockResolvedValue(undefined);
      mockFetchGuard.mockResolvedValue({
        response: { ok: false, status: 500, headers: new Headers() },
        finalUrl: 'https://example.com/x.png',
        release,
      });
      await expect(
        prepareOutboundMedia('https://example.com/x.png')
      ).rejects.toThrow();
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('rejecting release() is remapped to fixed phrase, secret suppressed', async () => {
      const secret = 'boom-SECRET-cleanup-9821';
      mockFetchGuard.mockResolvedValue({
        response: {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
        },
        finalUrl: 'https://example.com/x.png',
        release: vi.fn().mockRejectedValue(new Error(secret)),
      });
      mockReadLimit.mockResolvedValue(PNG_BYTES);
      try {
        await prepareOutboundMedia('https://example.com/x.png');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toBe(
          'Could not fetch media from the provided URL.'
        );
        expect((err as Error).message).not.toContain(secret);
      }
    });
  });

  describe('uppercase scheme happy path', () => {
    it('HTTPS:// classifies, fetches, and passes finalUrl check', async () => {
      mockFetchGuard.mockResolvedValue({
        response: {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
        },
        finalUrl: 'HTTPS://example.com/x.png',
        release: vi.fn().mockResolvedValue(undefined),
      });
      mockReadLimit.mockResolvedValue(PNG_BYTES);
      mockDetectMime.mockResolvedValue('image/png');
      mockNormalizeMimeType.mockReturnValue('image/png');
      mockNoStorage();

      const result = await prepareOutboundMedia('HTTPS://example.com/x.png');
      expect(result.isImage).toBe(true);
      expect(result.url).toBe('https://example.com/x.png');
    });
  });

  describe('backslash URL canonical posting', () => {
    it('posts canonical form, not raw backslash spelling', async () => {
      mockFetchGuard.mockResolvedValue({
        response: {
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
        },
        finalUrl: 'https://host/path@name.png',
        release: vi.fn().mockResolvedValue(undefined),
      });
      mockReadLimit.mockResolvedValue(PNG_BYTES);
      mockDetectMime.mockResolvedValue('image/png');
      mockNormalizeMimeType.mockReturnValue('image/png');
      mockNoStorage();

      const result = await prepareOutboundMedia('https://host\\path@name.png');
      expect(result.url).toBe('https://host/path@name.png');
    });
  });

  describe('S3-capable upload', () => {
    it('uploads and returns uploaded URL with correct filename', async () => {
      mockImageFetch();
      mockS3Capable();
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/uploaded.png',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(result.url).toBe('https://storage.example.com/uploaded.png');
      expect(result.isImage).toBe(true);
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/^upload-\d+-[0-9a-f-]{36}\.png$/),
        })
      );

      const uploadArg = mockUploadFile.mock.calls[0][0];
      const uploadedBytes = new Uint8Array(await uploadArg.blob.arrayBuffer());
      expect(uploadedBytes).toEqual(new Uint8Array(PNG_BYTES));
      expect(uploadArg.blob.type).toBe('image/png');
      expect(uploadArg.contentType).toBe('image/png');
    });
  });

  describe('filename edge cases', () => {
    it('sniffed PNG gets .png extension', async () => {
      mockImageFetch();
      mockS3Capable();
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/f.png',
      });
      await prepareOutboundMedia('https://example.com/image.png');
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/\.png$/),
        })
      );
    });

    it('SVG header fallback with sniff-undefined gets .svg and isImage', async () => {
      mockFetchGuard.mockResolvedValue(
        mockGuardSuccess(
          Buffer.from('<svg></svg>'),
          'image/svg+xml; charset=utf-8'
        )
      );
      mockReadLimit.mockResolvedValue(Buffer.from('<svg></svg>'));
      mockDetectMime.mockResolvedValue(undefined);
      mockNormalizeMimeType.mockReturnValue('image/svg+xml');
      mockExtensionForMime.mockReturnValue('.svg');
      mockS3Capable();
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/f.svg',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.svg'
      );
      expect(result.isImage).toBe(true);
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/\.svg$/),
        })
      );
    });

    it('unknown MIME gets .bin extension', async () => {
      mockFetchGuard.mockResolvedValue(
        mockGuardSuccess(Buffer.from('xyz'), 'application/x-custom')
      );
      mockReadLimit.mockResolvedValue(Buffer.from('xyz'));
      mockDetectMime.mockResolvedValue(undefined);
      mockNormalizeMimeType.mockReturnValue('application/x-custom');
      mockExtensionForMime.mockReturnValue(undefined);
      mockS3Capable();
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/f.bin',
      });

      await prepareOutboundMedia('https://example.com/file.xyz');
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/\.bin$/),
        })
      );
    });
  });

  describe('production-shaped (TLON_HOSTING without S3 creds)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uploads via uploadFile with assume-hosted', async () => {
      vi.stubEnv('TLON_HOSTING', 'true');
      mockImageFetch();
      mockScry.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/credentials') {
          return {
            'storage-update': {
              credentials: {
                accessKeyId: '',
                endpoint: '',
                secretAccessKey: '',
              },
            },
          };
        }
        return {
          'storage-update': {
            configuration: { service: 'presigned-url', currentBucket: '' },
          },
        };
      });
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/uploaded.png',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          hostedDetection: 'assume-hosted',
        })
      );
      expect(result.url).toBe('https://storage.example.com/uploaded.png');
    });

    it('TLON_HOSTING=1 + moon-shaped scries (service credentials, no creds) → uploads', async () => {
      vi.stubEnv('TLON_HOSTING', '1');
      mockImageFetch();
      mockScry.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/credentials') {
          return {
            'storage-update': {
              credentials: {
                accessKeyId: '',
                endpoint: '',
                secretAccessKey: '',
              },
            },
          };
        }
        return {
          'storage-update': {
            configuration: { service: 'credentials', currentBucket: '' },
          },
        };
      });
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example.com/moon-uploaded.png',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          hostedDetection: 'assume-hosted',
        })
      );
      expect(result.url).toBe('https://storage.example.com/moon-uploaded.png');
    });
  });

  describe('no storage', () => {
    it('scry empty → hotlink, no uploadFile', async () => {
      mockImageFetch();
      mockScry.mockResolvedValue({
        'storage-update': {
          credentials: {},
          configuration: {},
        },
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(result.url).toBe('https://example.com/image.png');
    });

    it('scry throws → hotlink, does not fail send', async () => {
      mockImageFetch();
      mockScry.mockRejectedValue(new Error('scry failed'));

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(result.url).toBe('https://example.com/image.png');
    });

    it('moon-shaped (not hosted, poked to presigned-url, no creds) → hotlink, no uploadFile', async () => {
      mockImageFetch();
      mockMoonShaped();

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(result.url).toBe('https://example.com/image.png');
    });
  });

  describe('hosted ship without custom S3 (uploadFile routes to Memex)', () => {
    it('uploads rather than hotlinking', async () => {
      mockImageFetch();
      mockHostedPresigned();
      mockUploadFile.mockResolvedValue({
        url: 'https://memex.tlon.network/hosted.png',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      expect(result.url).toBe('https://memex.tlon.network/hosted.png');
    });

    it('still uploads when hosted with custom S3 but no current bucket', async () => {
      mockImageFetch();
      mockIsHosted.mockReturnValue(true);
      mockScry.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/credentials') {
          return {
            'storage-update': {
              credentials: {
                accessKeyId: 'ak',
                endpoint: 'https://s3.example.com',
                secretAccessKey: 'sk',
              },
            },
          };
        }
        return {
          'storage-update': {
            configuration: { service: 'presigned-url', currentBucket: '' },
          },
        };
      });
      mockUploadFile.mockResolvedValue({
        url: 'https://memex.tlon.network/hosted2.png',
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      expect(result.url).toBe('https://memex.tlon.network/hosted2.png');
    });
  });

  describe('partial config (creds but no bucket)', () => {
    it('does not call uploadFile, hotlinks', async () => {
      mockImageFetch();
      mockScry.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/credentials') {
          return {
            'storage-update': {
              credentials: {
                accessKeyId: 'ak',
                endpoint: 'https://s3.example.com',
                secretAccessKey: 'sk',
              },
            },
          };
        }
        return {
          'storage-update': {
            configuration: { currentBucket: '' },
          },
        };
      });

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(result.url).toBe('https://example.com/image.png');
    });
  });

  describe('upload failure fallback', () => {
    it('upload throws → hotlink + fixed-phrase log', async () => {
      mockImageFetch();
      mockS3Capable();
      mockUploadFile.mockRejectedValue(
        new Error('No storage credentials configured')
      );

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(result.url).toBe('https://example.com/image.png');
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('[tlon] media: upload failed');
      expect(logOutput).not.toContain('No storage credentials configured');
    });
  });

  describe('strictPostableUrl fallback cases', () => {
    const nonPostableReturns = [
      'http://storage.example.com/f.png',
      'https://user:pw@storage.example.com/f.png',
      'https:foo',
      'https:///foo',
      'https://@host/f.png',
      'MEDIA: https://storage.example.com/f.png',
      ' https://storage.example.com/f.png',
      'https://storage.example.com/f.png ',
      '\thttps://storage.example.com/f.png',
      'https://storage.example.com/f.png\t',
      '\nhttps://storage.example.com/f.png',
      'https://storage.example.com/f.png\n',
    ];

    it.each(nonPostableReturns)(
      'uploadFile returning %j → hotlink fallback',
      async (badUrl) => {
        mockImageFetch();
        mockS3Capable();
        mockUploadFile.mockResolvedValue({ url: badUrl });

        const result = await prepareOutboundMedia(
          'https://example.com/image.png'
        );
        expect(result.url).toBe('https://example.com/image.png');
      }
    );
  });

  describe('image vs link classification', () => {
    it('HTML bytes at .png URL → isImage false (link)', async () => {
      mockFetchGuard.mockResolvedValue(
        mockGuardSuccess(HTML_BYTES, 'text/html')
      );
      mockReadLimit.mockResolvedValue(HTML_BYTES);
      mockDetectMime.mockResolvedValue('text/html');
      mockNormalizeMimeType.mockReturnValue('text/html');
      mockNoStorage();

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(result.isImage).toBe(false);
      expect(mockDetectMime).toHaveBeenCalledWith({ buffer: HTML_BYTES });
      expect(mockNormalizeMimeType).toHaveBeenCalledWith('text/html');
    });

    it('HTML bytes with header image/png → link (sniff undefined, header fallback is svg-only)', async () => {
      mockFetchGuard.mockResolvedValue(
        mockGuardSuccess(HTML_BYTES, 'image/png')
      );
      mockReadLimit.mockResolvedValue(HTML_BYTES);
      mockDetectMime.mockResolvedValue(undefined);
      mockNormalizeMimeType.mockReturnValue('image/png');
      mockNoStorage();

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(result.isImage).toBe(false);
      expect(mockDetectMime).toHaveBeenCalledWith({ buffer: HTML_BYTES });
      expect(mockNormalizeMimeType).toHaveBeenCalledWith('image/png');
    });

    it('real PNG bytes + wrong header → image (sniff wins)', async () => {
      mockFetchGuard.mockResolvedValue(
        mockGuardSuccess(PNG_BYTES, 'text/html')
      );
      mockReadLimit.mockResolvedValue(PNG_BYTES);
      mockDetectMime.mockResolvedValue('image/png');
      mockNormalizeMimeType.mockReturnValue('text/html');
      mockNoStorage();

      const result = await prepareOutboundMedia(
        'https://example.com/image.png'
      );
      expect(result.isImage).toBe(true);
      expect(mockDetectMime).toHaveBeenCalledWith({ buffer: PNG_BYTES });
      expect(mockNormalizeMimeType).toHaveBeenCalledWith('text/html');
    });
  });

  describe('MEDIA: prefix normalization', () => {
    it('MEDIA: https://… proceeds normally', async () => {
      mockImageFetch();
      mockNoStorage();

      const result = await prepareOutboundMedia(
        'MEDIA: https://example.com/image.png'
      );
      expect(result.url).toBe('https://example.com/image.png');
      expect(mockFetchGuard).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/image.png' })
      );
    });
  });
});
