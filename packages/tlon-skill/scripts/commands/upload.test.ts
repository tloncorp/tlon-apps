import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_CONTENT_TYPE,
  UPLOAD_HELP,
  type UploadBlobLike,
  type UploadDeps,
  run,
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
    fetchResponse?: UploadDeps['fetch'];
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
    readStdin: async () => {
      calls.readStdin += 1;
      return options.stdin ?? bytes([1, 2, 3]);
    },
    fetch:
      options.fetchResponse ??
      (async (url) => {
        calls.fetch.push(url);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          blob: async () => ({ type: 'image/jpeg', size: 3, label: 'remote' }),
        };
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

  it('uploads URL data with injected fetch', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['https://example.com/path/photo.jpg'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.fetch).toEqual(['https://example.com/path/photo.jpg']);
    expect(context.calls.createBlob).toEqual([]);
    expect(context.calls.uploadFile).toHaveLength(1);
    expect(context.calls.uploadFile[0]).toMatchObject({
      contentType: 'image/jpeg',
      fileName: 'photo.jpg',
    });
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

  it('rejects fetch failures as expected command errors', async () => {
    const context = makeDeps({
      fetchResponse: async () => {
        throw new Error('network down');
      },
    });

    const exitCode = await run(
      ['https://example.com/path/photo.jpg'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: Failed to fetch: network down\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.uploadFile).toEqual([]);
  });

  it('rejects blob read failures as expected command errors', async () => {
    const context = makeDeps({
      fetchResponse: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        blob: async () => {
          throw new Error('body unavailable');
        },
      }),
    });

    const exitCode = await run(
      ['https://example.com/path/photo.jpg'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      'Error: Failed to read response body: body unavailable\n'
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
