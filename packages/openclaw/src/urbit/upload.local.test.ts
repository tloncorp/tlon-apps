import { uploadFile } from '@tloncorp/api';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { parseRasterHeader } from './image-dimensions.js';
import {
  pngHeaderBytes,
  realBaselineJpegBytes,
  realProgressiveJpegBytes,
  realWebpAnimatedBytes,
  realWebpLosslessBytes,
  realWebpLossyBytes,
  realWebpVp8xStaticBytes,
  validGifBytes,
  validPngBytes,
} from './test-fixtures.js';
import { prepareOutboundMedia } from './upload.js';

// Local cases use the REAL loadWebMedia + buildOutboundMediaLoadOptions against
// temp-dir fixtures; only @tloncorp/api's uploadFile is mocked.
vi.mock('@tloncorp/api', () => ({
  uploadFile: vi.fn(),
}));

const mockUploadFile = vi.mocked(uploadFile);

let tmpdir: string;
let tmpdir2: string;

function writeFixture(name: string, bytes: Uint8Array | string): string {
  const filePath = path.join(tmpdir, name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

const readFileCapability = (p: string) => fs.promises.readFile(p);

beforeAll(() => {
  tmpdir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-media-'))
  );
  tmpdir2 = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-media-other-'))
  );
});

afterAll(() => {
  fs.rmSync(tmpdir, { recursive: true, force: true });
  fs.rmSync(tmpdir2, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prepareOutboundMedia (local, real loader)', () => {
  it('genuine PNG fixture sniffs as image/png and parses with real dimensions', async () => {
    const { detectMime } = await import('openclaw/plugin-sdk/media-mime');
    const bytes = validPngBytes();
    expect(await detectMime({ buffer: bytes })).toBe('image/png');
    expect(parseRasterHeader(bytes)).toEqual({
      format: 'png',
      width: 1,
      height: 1,
    });
  });

  it('genuine GIF fixture sniffs as image/gif and parses with real dimensions', async () => {
    const { detectMime } = await import('openclaw/plugin-sdk/media-mime');
    const bytes = validGifBytes();
    expect(await detectMime({ buffer: bytes })).toBe('image/gif');
    expect(parseRasterHeader(bytes)).toEqual({
      format: 'gif',
      width: 1,
      height: 1,
    });
  });

  it('genuine JPEG fixtures sniff as image/jpeg and parse with real dimensions', async () => {
    const { detectMime } = await import('openclaw/plugin-sdk/media-mime');
    const baseline = realBaselineJpegBytes();
    expect(await detectMime({ buffer: baseline })).toBe('image/jpeg');
    expect(parseRasterHeader(baseline)).toEqual({
      format: 'jpeg',
      width: 2,
      height: 3,
    });
    const progressive = realProgressiveJpegBytes();
    expect(await detectMime({ buffer: progressive })).toBe('image/jpeg');
    expect(parseRasterHeader(progressive)).toEqual({
      format: 'jpeg',
      width: 4,
      height: 2,
    });
  });

  it('genuine WebP fixtures sniff as image/webp and parse with real dimensions', async () => {
    const { detectMime } = await import('openclaw/plugin-sdk/media-mime');
    const lossy = realWebpLossyBytes();
    expect(await detectMime({ buffer: lossy })).toBe('image/webp');
    expect(parseRasterHeader(lossy)).toEqual({
      format: 'webp',
      width: 5,
      height: 4,
    });
    const lossless = realWebpLosslessBytes();
    expect(await detectMime({ buffer: lossless })).toBe('image/webp');
    expect(parseRasterHeader(lossless)).toEqual({
      format: 'webp',
      width: 5,
      height: 4,
    });
    const vp8xStatic = realWebpVp8xStaticBytes();
    expect(await detectMime({ buffer: vp8xStatic })).toBe('image/webp');
    expect(parseRasterHeader(vp8xStatic)).toEqual({
      format: 'webp',
      width: 7,
      height: 3,
    });
    const animated = realWebpAnimatedBytes();
    expect(await detectMime({ buffer: animated })).toBe('image/webp');
    expect(parseRasterHeader(animated)).toEqual({
      format: 'webp',
      width: 6,
      height: 5,
    });
  });

  it('uploads a local PNG with roots only', async () => {
    const pngPath = writeFixture('img.png', validPngBytes());
    mockUploadFile.mockResolvedValue({
      url: 'https://storage.example/u/img.png',
    });
    const result = await prepareOutboundMedia(pngPath, {
      mediaLocalRoots: [tmpdir],
    });
    expect(result).toEqual({
      url: 'https://storage.example/u/img.png',
      isImage: true,
      width: 1,
      height: 1,
      contentType: 'image/png',
    });
  });

  it('uploads a local PNG with roots + readFile (host-read admits real images)', async () => {
    const pngPath = writeFixture('img-host.png', validPngBytes());
    mockUploadFile.mockResolvedValue({
      url: 'https://storage.example/u/h.png',
    });
    const result = await prepareOutboundMedia(pngPath, {
      mediaLocalRoots: [tmpdir],
      mediaReadFile: readFileCapability,
    });
    expect(result.isImage).toBe(true);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('rejects plaintext named notes.png under roots + readFile (byte verification)', async () => {
    const notesPath = writeFixture(
      'notes.png',
      'this is definitely not an image, just plain text content'
    );
    await expect(
      prepareOutboundMedia(notesPath, {
        mediaLocalRoots: [tmpdir],
        mediaReadFile: readFileCapability,
      })
    ).rejects.toThrow(
      /Cannot read media .*Media path or file type is not allowed/
    );
  });

  it('rejects a path outside the allowed roots', async () => {
    const outside = path.join(tmpdir2, 'outside.png');
    fs.writeFileSync(outside, pngHeaderBytes(10, 20));
    await expect(
      prepareOutboundMedia(outside, { mediaLocalRoots: [tmpdir] })
    ).rejects.toThrow(/Cannot read media/);
  });

  it('rejects a missing file', async () => {
    await expect(
      prepareOutboundMedia(path.join(tmpdir, 'missing.png'), {
        mediaLocalRoots: [tmpdir],
      })
    ).rejects.toThrow(/Cannot read media/);
  });

  it('rejects a local .svg up front', async () => {
    await expect(
      prepareOutboundMedia(path.join(tmpdir, 'does-not-exist.svg'), {
        mediaLocalRoots: [tmpdir],
      })
    ).rejects.toThrow(/convert it to PNG/);
  });

  it('rejects a percent-encoded file:// .svg up front', async () => {
    await expect(
      prepareOutboundMedia(`file://${tmpdir}/nope%2Esvg`, {
        mediaLocalRoots: [tmpdir],
      })
    ).rejects.toThrow(/convert it to PNG/);
  });

  it('rejects an uppercase .SVG up front', async () => {
    await expect(
      prepareOutboundMedia(path.join(tmpdir, 'nope.SVG'), {
        mediaLocalRoots: [tmpdir],
      })
    ).rejects.toThrow(/convert it to PNG/);
  });

  it('rejects a local SVG with a >8KiB comment preamble under a non-.svg name (roots only)', async () => {
    const preamble = '<!--' + 'a'.repeat(70 * 1024) + '-->';
    const svgPath = writeFixture(
      'sneaky.xml',
      preamble + '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    );
    await expect(
      prepareOutboundMedia(svgPath, { mediaLocalRoots: [tmpdir] })
    ).rejects.toThrow(/convert it to PNG/);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects a local file with >64KiB of pure whitespace and no root (roots only)', async () => {
    const wsPath = writeFixture('blank.xml', ' '.repeat(70 * 1024));
    await expect(
      prepareOutboundMedia(wsPath, { mediaLocalRoots: [tmpdir] })
    ).rejects.toThrow(/convert it to PNG/);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('strips the MEDIA: prefix for local paths', async () => {
    const pngPath = writeFixture('prefixed.png', validPngBytes());
    mockUploadFile.mockResolvedValue({
      url: 'https://storage.example/u/p.png',
    });
    const result = await prepareOutboundMedia(`MEDIA:${pngPath}`, {
      mediaLocalRoots: [tmpdir],
    });
    expect(result.isImage).toBe(true);
  });

  it('adds the storage-config hint when upload reports no credentials', async () => {
    const pngPath = writeFixture('nocreds.png', validPngBytes());
    mockUploadFile.mockRejectedValue(
      new Error('No storage credentials configured')
    );
    await expect(
      prepareOutboundMedia(pngPath, { mediaLocalRoots: [tmpdir] })
    ).rejects.toThrow(/No storage credentials configured/);
    await expect(
      prepareOutboundMedia(pngPath, { mediaLocalRoots: [tmpdir] })
    ).rejects.toThrow(/no storage configured/);
  });

  it.each([
    [
      'a cause bearing a signed S3 query',
      'PUT https://s3.example.com/key?X-Amz-Signature=secret failed',
      [
        'X-Amz-Signature=secret',
        'secret',
        'X-Amz-Signature',
        'PUT',
        's3.example',
      ],
    ],
    [
      'a scheme-less cause bearing a signed query',
      'request failed for /bucket/key?X-Amz-Signature=secretvalue',
      ['X-Amz-Signature', 'secretvalue', 'request failed', '/bucket/key'],
    ],
  ])(
    'uses a fixed category message for local upload errors with %s (never interpolates raw cause)',
    async (_label, rawMessage, forbidden) => {
      const pngPath = writeFixture('upload-err.png', validPngBytes());
      mockUploadFile.mockRejectedValue(new Error(rawMessage));
      const promise = prepareOutboundMedia(pngPath, {
        mediaLocalRoots: [tmpdir],
      });
      await expect(promise).rejects.toThrow(/Failed to upload local media/);
      await expect(promise).rejects.toThrow(/Media upload failed/);
      await expect(promise).rejects.not.toThrow(/no storage configured/);
      for (const s of forbidden) {
        await expect(promise).rejects.not.toThrow(s);
      }
    }
  );

  it.each([
    ['an ordinary path', 'photo.png', ['photo']],
    ['a #-fragment name', 'chart#1.png', ['#', 'chart']],
    [
      'a percent-encoded name',
      'file%3Fsig=secretvalue.png',
      ['secretvalue', 'secret', '3F', 'file'],
    ],
    ['an @-bearing name', 'file@2x.png', ['@', 'file']],
    [
      'a ?sig= name',
      'id?sig=secretvalue.png',
      ['secretvalue', 'secret', 'sig', 'id'],
    ],
  ])(
    'always uses a synthetic upload filename for %s (never derives it from the path)',
    async (_label, name, forbidden) => {
      const pngPath = writeFixture(name, validPngBytes());
      mockUploadFile.mockResolvedValue({
        url: 'https://storage.example/u/x.png',
      });
      const result = await prepareOutboundMedia(pngPath, {
        mediaLocalRoots: [tmpdir],
      });
      expect(result.isImage).toBe(true);
      const fileName = mockUploadFile.mock.calls[0][0].fileName as string;
      expect(fileName).toMatch(/^upload-\d+-[0-9a-f-]{36}\.png$/);
      expect(fileName).toMatch(/^[A-Za-z0-9._-]+$/);
      for (const s of forbidden) {
        expect(fileName).not.toContain(s);
      }
    }
  );

  it('rejects with a generic message when the uploaded URL is invalid', async () => {
    const pngPath = writeFixture('badurl.png', validPngBytes());
    mockUploadFile.mockResolvedValue({ url: 'http://insecure.example/x.png' });
    const promise = prepareOutboundMedia(pngPath, {
      mediaLocalRoots: [tmpdir],
    });
    await expect(promise).rejects.toThrow(/Failed to upload local media/);
    await expect(promise).rejects.not.toThrow(/insecure\.example/);
  });
});
