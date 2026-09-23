import { describe, expect, it } from 'bun:test';

import { USERINFO_ERROR } from '../media-guard';
import { commandError } from './command';
import {
  CANNOT_STORE_UPLOADS_ERROR,
  DEFAULT_CONTENT_TYPE,
  NO_BUCKET_SELECTED_ERROR,
  UNPOSTABLE_UPLOAD_URL_ERROR,
  UPLOAD_GUARD_OPTIONS,
  UPLOAD_HELP,
  type UploadBlobLike,
  type UploadDeps,
  type UploadPreflight,
  run,
  shipCanStoreUploads,
} from './upload';

type TestBlob = UploadBlobLike & {
  data?: number[];
  label?: string;
};

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function makeDeps(
  options: {
    stdin?: Uint8Array;
    fetchSource?: UploadDeps['fetchSource'];
    canStoreUploads?: UploadPreflight | null;
    fileExists?: boolean;
    fileBytes?: Uint8Array;
    resolvedPath?: string;
    extension?: string;
    uploadUrl?: string;
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    canStoreUploads: 0,
    readStdin: 0,
    fetch: [] as string[],
    resolvePath: [] as string[],
    exists: [] as string[],
    readFile: [] as string[],
    createBlob: [] as Array<{ data: number[]; contentType: string }>,
    uploadFile: [] as Array<
      Parameters<UploadDeps['uploadApi']['uploadFile']>[0]
    >,
  };

  const deps: UploadDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
    },
    canStoreUploads: async () => {
      calls.canStoreUploads += 1;
      return options.canStoreUploads === undefined
        ? { canStore: true }
        : options.canStoreUploads;
    },
    readStdin: async () => {
      calls.readStdin += 1;
      return options.stdin ?? bytes([1, 2, 3]);
    },
    fetchSource:
      options.fetchSource ??
      (async (url) => {
        calls.fetch.push(url);
        return { bytes: bytes([1, 2, 3]), contentType: 'image/jpeg' };
      }),
    fileSystem: {
      resolvePath: (filePath) => {
        calls.resolvePath.push(filePath);
        return options.resolvedPath ?? `/resolved/${filePath}`;
      },
      exists: (filePath) => {
        calls.exists.push(filePath);
        return options.fileExists ?? true;
      },
      readFile: (filePath) => {
        calls.readFile.push(filePath);
        return options.fileBytes ?? bytes([9, 8, 7]);
      },
      basename: (filePath) => filePath.split('/').filter(Boolean).at(-1) ?? '',
      extension: () => options.extension ?? '.jpg',
    },
    createBlob: (data, contentType): TestBlob => {
      const record = { data: Array.from(data), contentType };
      calls.createBlob.push(record);
      return { type: contentType, size: data.byteLength, data: record.data };
    },
    uploadApi: {
      uploadFile: async (input) => {
        calls.uploadFile.push(input);
        return { url: options.uploadUrl ?? 'https://storage.example/uploaded' };
      },
    },
  };

  return {
    deps,
    calls,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

describe('upload command run', () => {
  it('prints help without authenticating or touching IO', async () => {
    const context = makeDeps();

    const exitCode = await run(['--help'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`${UPLOAD_HELP}\n`);
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticate).toBe(0);
    expect(context.calls.readStdin).toBe(0);
    expect(context.calls.fetch).toEqual([]);
    expect(context.calls.resolvePath).toEqual([]);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('fails local usage errors before auth or IO', async () => {
    const cases = [
      { args: [] as string[], expected: 'Usage: tlon upload' },
      {
        args: ['--definitely-not-an-option'],
        expected: 'Unknown option: --definitely-not-an-option',
      },
      { args: ['-t'], expected: '-t requires a value' },
      {
        args: ['--stdin', 'photo.jpg'],
        expected: '--stdin cannot be combined with a file or URL',
      },
    ];

    for (const testCase of cases) {
      const context = makeDeps();
      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(testCase.expected);
      expect(context.stderr()).toContain('Usage: tlon upload');
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.readStdin).toBe(0);
      expect(context.calls.fetch).toEqual([]);
      expect(context.calls.resolvePath).toEqual([]);
      expect(context.calls.uploadFile).toEqual([]);
    }
  });

  it('uploads stdin data with injected stdin and Blob construction', async () => {
    const context = makeDeps({ stdin: bytes([4, 5, 6]) });

    const exitCode = await run(['--stdin', '-t', 'image/png'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://storage.example/uploaded\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.readStdin).toBe(1);
    expect(context.calls.createBlob).toEqual([
      { data: [4, 5, 6], contentType: 'image/png' },
    ]);
    expect(context.calls.uploadFile).toHaveLength(1);
    expect(context.calls.uploadFile[0].contentType).toBe('image/png');
    expect('fileName' in context.calls.uploadFile[0]).toBe(false);
    expect((context.calls.uploadFile[0].blob as TestBlob).data).toEqual([
      4, 5, 6,
    ]);
  });

  it('rejects empty stdin as an expected command error', async () => {
    const context = makeDeps({ stdin: bytes([]) });

    const exitCode = await run(['--stdin'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: No data received on stdin\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.readStdin).toBe(1);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('uploads URL data through the guarded fetch', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['https://example.com/path/photo.jpg'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.fetch).toEqual(['https://example.com/path/photo.jpg']);
    expect(context.calls.createBlob).toEqual([
      { data: [1, 2, 3], contentType: 'image/jpeg' },
    ]);
    expect(context.calls.uploadFile).toHaveLength(1);
    expect(context.calls.uploadFile[0]).toMatchObject({
      contentType: 'image/jpeg',
      fileName: 'photo.jpg',
    });
  });

  it('fetches the canonical source URL and drops content-type parameters', async () => {
    const fetched: string[] = [];
    const context = makeDeps({
      fetchSource: async (url) => {
        fetched.push(url);
        return { bytes: bytes([7]), contentType: 'image/PNG; charset=binary' };
      },
    });

    const exitCode = await run(
      ['HTTPS://Example.com/path/photo.bin'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(fetched).toEqual(['https://example.com/path/photo.bin']);
    expect(context.calls.uploadFile[0].contentType).toBe('image/png');
  });

  it('accepts plain-http sources (the source URL is never posted)', async () => {
    const context = makeDeps();

    const exitCode = await run(['http://example.com/photo.jpg'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.fetch).toEqual(['http://example.com/photo.jpg']);
  });

  it('rejects source URLs with embedded credentials before fetching', async () => {
    for (const input of [
      'https://user:pw@example.com/photo.jpg',
      'http://user:pw@example.com/photo.jpg',
      'https://@example.com/photo.jpg',
    ]) {
      const context = makeDeps();
      const exitCode = await run([input], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stderr()).toBe(`Error: ${USERINFO_ERROR}\n`);
      expect(context.calls.fetch).toEqual([]);
      expect(context.calls.uploadFile).toEqual([]);
    }
  });

  it('uses MIME override for URL uploads', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['https://example.com/path/photo.bin', '--type', 'image/webp'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.uploadFile[0]).toMatchObject({
      contentType: 'image/webp',
      fileName: 'photo.bin',
    });
  });

  it('rejects malformed URLs as expected command errors before fetch', async () => {
    const context = makeDeps();

    const exitCode = await run(['https://'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: Invalid URL: https://\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.fetch).toEqual([]);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('surfaces guarded-fetch failures without uploading', async () => {
    const context = makeDeps({
      fetchSource: async () => {
        throw commandError('Could not fetch media from the provided URL.');
      },
    });

    const exitCode = await run(
      ['https://example.com/path/photo.jpg'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      'Error: Could not fetch media from the provided URL.\n'
    );
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('omits URL filenames when the path has no basename', async () => {
    const context = makeDeps();

    const exitCode = await run(['https://example.com/'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.uploadFile).toHaveLength(1);
    expect(context.calls.uploadFile[0].contentType).toBe('image/jpeg');
    expect('fileName' in context.calls.uploadFile[0]).toBe(false);
  });

  it('uploads local files with injected filesystem reads', async () => {
    const context = makeDeps({
      resolvedPath: '/tmp/photo.jpg',
      fileBytes: bytes([10, 11]),
      extension: '.jpg',
    });

    const exitCode = await run(['./photo.jpg'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.resolvePath).toEqual(['./photo.jpg']);
    expect(context.calls.exists).toEqual(['/tmp/photo.jpg']);
    expect(context.calls.readFile).toEqual(['/tmp/photo.jpg']);
    expect(context.calls.createBlob).toEqual([
      { data: [10, 11], contentType: 'image/jpeg' },
    ]);
    expect(context.calls.uploadFile[0]).toMatchObject({
      contentType: 'image/jpeg',
      fileName: 'photo.jpg',
    });
    expect((context.calls.uploadFile[0].blob as TestBlob).data).toEqual([
      10, 11,
    ]);
  });

  it('uses MIME override for local file uploads', async () => {
    const context = makeDeps({
      resolvedPath: '/tmp/mystery',
      extension: '',
    });

    const exitCode = await run(
      ['/tmp/mystery', '-t', 'image/webp'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.createBlob).toEqual([
      { data: [9, 8, 7], contentType: 'image/webp' },
    ]);
    expect(context.calls.uploadFile[0]).toMatchObject({
      contentType: 'image/webp',
      fileName: 'mystery',
    });
  });

  it('falls back to the default MIME type for unknown local extensions', async () => {
    const context = makeDeps({
      resolvedPath: '/tmp/blob.unknown',
      extension: '.unknown',
    });

    const exitCode = await run(['/tmp/blob.unknown'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.createBlob).toEqual([
      { data: [9, 8, 7], contentType: DEFAULT_CONTENT_TYPE },
    ]);
    expect(context.calls.uploadFile[0].contentType).toBe(DEFAULT_CONTENT_TYPE);
  });
});

describe('upload guard budget', () => {
  it('uses general-file limits, not the --image media limits', () => {
    expect(UPLOAD_GUARD_OPTIONS).toEqual({
      maxBytes: 100 * 1024 * 1024,
      deadlineMs: 120_000,
      maxRedirects: 3,
      requireHttps: false,
    });
  });
});

describe('upload capability pre-flight', () => {
  it('refuses before reading any bytes when the ship cannot store uploads', async () => {
    for (const args of [
      ['https://example.com/photo.jpg'],
      ['./photo.jpg'],
      ['--stdin', '-t', 'image/png'],
    ]) {
      const context = makeDeps({
        canStoreUploads: { canStore: false, reason: 'no-storage' },
      });

      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${CANNOT_STORE_UPLOADS_ERROR}\n`);
      expect(context.calls.authenticate).toBe(1);
      expect(context.calls.canStoreUploads).toBe(1);
      // No input bytes were read or fetched.
      expect(context.calls.fetch).toEqual([]);
      expect(context.calls.readFile).toEqual([]);
      expect(context.calls.readStdin).toBe(0);
      expect(context.calls.uploadFile).toEqual([]);
    }
  });

  it('names the missing bucket when credentials exist but no bucket is selected', async () => {
    // Credentials-without-bucket is fixed in storage settings; telling that
    // operator they have "no custom S3 credentials" would be false twice over.
    const context = makeDeps({
      canStoreUploads: { canStore: false, reason: 'no-bucket' },
    });

    const exitCode = await run(['https://example.com/photo.jpg'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(`Error: ${NO_BUCKET_SELECTED_ERROR}\n`);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('proceeds when the capability check is indeterminate', async () => {
    // A scry failure must not become a false "cannot store" — uploadFile's own
    // error stays authoritative.
    const context = makeDeps({ canStoreUploads: null });

    const exitCode = await run(['https://example.com/photo.jpg'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.canStoreUploads).toBe(1);
    expect(context.calls.uploadFile).toHaveLength(1);
  });

  it('runs the check after authentication and before help is not reached', async () => {
    const context = makeDeps();
    await run(['--help'], context.deps);
    expect(context.calls.canStoreUploads).toBe(0);
  });
});

describe('upload printed-URL validation', () => {
  it('prints the canonical storage URL', async () => {
    const context = makeDeps({
      uploadUrl: 'HTTPS://Storage.example/uploads/a.png',
    });

    const exitCode = await run(['./photo.jpg'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('https://storage.example/uploads/a.png\n');
  });

  const unpostable = [
    'http://storage.example/uploads/a.png',
    'https://user:pw@storage.example/uploads/a.png',
    'not-a-url',
    '',
  ];

  for (const url of unpostable) {
    it(`fails instead of printing ${JSON.stringify(url)}`, async () => {
      const context = makeDeps({ uploadUrl: url });

      const exitCode = await run(['./photo.jpg'], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${UNPOSTABLE_UPLOAD_URL_ERROR}\n`);
    });
  }
});

describe('shipCanStoreUploads routing contract', () => {
  interface RoutingCase {
    name: string;
    hosted: boolean;
    configuration: { service?: string; currentBucket?: string } | null;
    credentials: {
      accessKeyId?: string;
      endpoint?: string;
      secretAccessKey?: string;
    } | null;
    canStore: boolean;
  }

  // The truth table `uploadFile` itself routes on (@tloncorp/api storageApi):
  // memex when the node is hosted and either the service is presigned-url or
  // custom S3 credentials are absent; otherwise custom S3 credentials plus a
  // selected bucket, which the S3 PUT needs.
  const FULL_CREDENTIALS = {
    accessKeyId: 'AKIA',
    endpoint: 'https://s3.example',
    secretAccessKey: 'secret',
  };
  const NO_CREDENTIALS = {
    accessKeyId: '',
    endpoint: '',
    secretAccessKey: '',
  };

  const cases: RoutingCase[] = [
    {
      name: 'hosted presigned-url no creds -> memex',
      hosted: true,
      configuration: { service: 'presigned-url', currentBucket: '' },
      credentials: NO_CREDENTIALS,
      canStore: true,
    },
    {
      name: 'hosted credentials-service no creds -> memex',
      hosted: true,
      configuration: { service: 'credentials', currentBucket: '' },
      credentials: NO_CREDENTIALS,
      canStore: true,
    },
    {
      name: 'hosted presigned-url with full creds -> memex',
      hosted: true,
      configuration: { service: 'presigned-url', currentBucket: '' },
      credentials: FULL_CREDENTIALS,
      canStore: true,
    },
    {
      name: 'hosted credentials-service with full creds and bucket -> custom S3',
      hosted: true,
      configuration: { service: 'credentials', currentBucket: 'media' },
      credentials: FULL_CREDENTIALS,
      canStore: true,
    },
    {
      name: 'hosted credentials-service with full creds but no bucket -> cannot store',
      hosted: true,
      configuration: { service: 'credentials', currentBucket: '' },
      credentials: FULL_CREDENTIALS,
      canStore: false,
    },
    {
      name: 'not hosted with full creds and bucket -> custom S3',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: 'media' },
      credentials: FULL_CREDENTIALS,
      canStore: true,
    },
    {
      name: 'not hosted with full creds and no bucket -> cannot store',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: '' },
      credentials: FULL_CREDENTIALS,
      canStore: false,
    },
    {
      name: 'not hosted missing accessKeyId -> cannot store',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: 'media' },
      credentials: { ...FULL_CREDENTIALS, accessKeyId: '' },
      canStore: false,
    },
    {
      name: 'not hosted missing endpoint -> cannot store',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: 'media' },
      credentials: { ...FULL_CREDENTIALS, endpoint: '' },
      canStore: false,
    },
    {
      name: 'not hosted missing secretAccessKey -> cannot store',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: 'media' },
      credentials: { ...FULL_CREDENTIALS, secretAccessKey: '' },
      canStore: false,
    },
    {
      name: 'not hosted with no creds -> cannot store',
      hosted: false,
      configuration: { service: 'credentials', currentBucket: '' },
      credentials: NO_CREDENTIALS,
      canStore: false,
    },
    {
      name: 'not hosted presigned-url without creds -> cannot store (memex needs a hosted node)',
      hosted: false,
      configuration: { service: 'presigned-url', currentBucket: '' },
      credentials: NO_CREDENTIALS,
      canStore: false,
    },
    {
      name: 'missing credentials and configuration objects -> cannot store',
      hosted: false,
      configuration: null,
      credentials: null,
      canStore: false,
    },
    {
      name: 'hosted with missing credentials object -> memex',
      hosted: true,
      configuration: null,
      credentials: null,
      canStore: true,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(
        shipCanStoreUploads({
          hosted: testCase.hosted,
          credentials: testCase.credentials,
          configuration: testCase.configuration,
        })
      ).toBe(testCase.canStore);
    });
  }
});
