import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  avifBytes,
  bmpBytes,
  heicBytes,
  icoBytes,
  pngCompleteBytes,
  validPngBytes,
} from './test-fixtures.js';

// Mock @tloncorp/api's uploadFile everywhere (test-double contract).
vi.mock('@tloncorp/api', () => ({
  uploadFile: vi.fn(),
}));

// Remote cases mock the web-media module — prepareOutboundMedia does not expose
// fetchImpl, so the module-level mock is the sanctioned seam.
vi.mock('openclaw/plugin-sdk/web-media', () => ({
  loadWebMedia: vi.fn(),
}));

// Control the byte sniff precisely while keeping the real extensionForMime.
vi.mock('openclaw/plugin-sdk/media-mime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('openclaw/plugin-sdk/media-mime')>();
  return { ...actual, detectMime: vi.fn() };
});

function utf16le(str: string): Uint8Array {
  const b = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    b[i * 2] = code & 0xff;
    b[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return b;
}

function utf16be(str: string): Uint8Array {
  const b = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    b[i * 2] = (code >>> 8) & 0xff;
    b[i * 2 + 1] = code & 0xff;
  }
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const SVG_XML =
  '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
const SVG_DOCTYPE =
  '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg"></svg>';
const NON_SVG_XML = '<?xml version="1.0"?><root><item/></root>';
const GARBAGE = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

describe('isSvgBytes', () => {
  it('detects plain, XML-declared, and DOCTYPE-prefixed SVG', async () => {
    const { isSvgBytes } = await import('./upload.js');
    expect(isSvgBytes(Buffer.from('<svg xmlns="x"></svg>'))).toBe(true);
    expect(isSvgBytes(Buffer.from(SVG_XML))).toBe(true);
    expect(isSvgBytes(Buffer.from(SVG_DOCTYPE))).toBe(true);
  });

  it('detects UTF-16LE and UTF-16BE BOM-marked SVG', async () => {
    const { isSvgBytes } = await import('./upload.js');
    expect(
      isSvgBytes(
        concat(new Uint8Array([0xff, 0xfe]), utf16le('<svg xmlns="x"></svg>'))
      )
    ).toBe(true);
    expect(
      isSvgBytes(
        concat(new Uint8Array([0xfe, 0xff]), utf16be('<svg xmlns="x"></svg>'))
      )
    ).toBe(true);
  });

  it('does not treat non-SVG XML or raster bytes as SVG', async () => {
    const { isSvgBytes } = await import('./upload.js');
    expect(isSvgBytes(Buffer.from(NON_SVG_XML))).toBe(false);
    expect(isSvgBytes(validPngBytes())).toBe(false);
  });

  it('detects SVG after a DOCTYPE whose quoted literal contains ">"', async () => {
    const { isSvgBytes } = await import('./upload.js');
    // A '>' inside the quoted SYSTEM literal must not terminate the DOCTYPE scan.
    expect(
      isSvgBytes(
        Buffer.from('<!DOCTYPE svg SYSTEM "foo>bar"><svg xmlns="x"></svg>')
      )
    ).toBe(true);
    expect(
      isSvgBytes(
        Buffer.from("<!DOCTYPE svg SYSTEM 'foo>bar'><svg xmlns='x'></svg>")
      )
    ).toBe(true);
  });
});

describe('safeUploadFileName', () => {
  it('replaces unsafe characters and forces the canonical extension', async () => {
    const { safeUploadFileName } = await import('./upload.js');
    expect(safeUploadFileName('chart#1.png', 'image/png')).toBe('chart-1.png');
    expect(safeUploadFileName('a%23b.png', 'image/png')).toBe('a-23b.png');
    // Mismatched extension is replaced with the canonical one.
    expect(safeUploadFileName('diagram.xml', 'image/svg+xml')).toBe(
      'diagram.svg'
    );
    expect(safeUploadFileName('blob.bin', 'image/svg+xml')).toBe('blob.svg');
  });

  it('generates a name when the candidate is empty or fully stripped', async () => {
    const { safeUploadFileName } = await import('./upload.js');
    expect(safeUploadFileName('', 'image/png')).toMatch(/^upload-\d+\.png$/);
    expect(safeUploadFileName('###', 'image/png')).toMatch(/^upload-\d+\.png$/);
  });

  it('only emits allowlisted characters', async () => {
    const { safeUploadFileName } = await import('./upload.js');
    const name = safeUploadFileName('we ird??name##.png', 'image/png');
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('classifyLoadedMedia', () => {
  it('classifies a genuine complete PNG as an image with real dims', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: validPngBytes(10, 20),
        sniffedMime: 'image/png',
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toEqual({
      kind: 'image',
      width: 10,
      height: 20,
      effectiveMime: 'image/png',
    });
  });

  it('throws on a zero-dimension PNG (bounds)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: pngCompleteBytes(0, 0),
        sniffedMime: 'image/png',
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toThrow(/not a valid png image/);
  });

  it('throws on an excessive-dimension PNG (bounds)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: pngCompleteBytes(100000, 100000),
        sniffedMime: 'image/png',
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toThrow(/not a valid png image/);
  });

  it('throws on a parse-success + sniff mismatch', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: validPngBytes(10, 20),
        sniffedMime: 'image/gif',
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toThrow(/not a valid png image/);
  });

  it('throws on a parse-success + absent sniff', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: validPngBytes(10, 20),
        sniffedMime: undefined,
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toThrow(/not a valid png image/);
  });

  it.each(['image/png', 'image/jpg', 'image/pjpeg', 'image/x-png'])(
    'throws on garbage bytes declared as %s (parser-supported never falls through)',
    async (mime) => {
      const { classifyLoadedMedia } = await import('./upload.js');
      expect(() =>
        classifyLoadedMedia({
          buffer: GARBAGE,
          loaderMime: mime,
          sniffedMime: undefined,
          isRemote: false,
          sourceLabel: 'x',
        })
      ).toThrow(/not a valid image/);
    }
  );

  it.each([
    ['image/avif', 'avif', avifBytes()],
    ['image/heic', 'heic', heicBytes()],
    ['image/bmp', 'bmp', bmpBytes()],
    ['image/x-icon', 'x-icon', icoBytes()],
  ])(
    'throws the convert hint for sniffed %s (not inlined)',
    async (mime, fmt, buffer) => {
      const { classifyLoadedMedia } = await import('./upload.js');
      expect(() =>
        classifyLoadedMedia({
          buffer,
          sniffedMime: mime,
          isRemote: true,
          sourceLabel: 'x',
        })
      ).toThrow(new RegExp(`${fmt} image that can't be posted inline`));
    }
  );

  it('classifies a genuine complete PNG with a conflicting loader MIME as a PNG image (raster parse is independent of loaderMime)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: validPngBytes(10, 20),
        loaderMime: 'application/pdf',
        sniffedMime: 'image/png',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toEqual({
      kind: 'image',
      width: 10,
      height: 20,
      effectiveMime: 'image/png',
    });
  });

  it('routes valid SVG with a conflicting loader image/png to the SVG branch (byte detection precedes parser-supported rejection)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: Buffer.from(SVG_XML),
        loaderMime: 'image/png',
        sniffedMime: 'application/xml',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toEqual({ kind: 'link', effectiveMime: 'image/svg+xml' });
  });

  it('rejects garbage that sniffs as image/png via the parser-supported branch (not the unsupported-image branch)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: GARBAGE,
        sniffedMime: 'image/png',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toThrow(/not a valid image/);
    // Proves the parser-supported rejection fired, not the "can't be posted
    // inline" unsupported-image branch.
    expect(() =>
      classifyLoadedMedia({
        buffer: GARBAGE,
        sniffedMime: 'image/png',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).not.toThrow(/can't be posted inline/);
  });

  it('throws the AVIF convert hint for avif bytes with loader image/jpeg (sniffed-unsupported precedes loader-parseable)', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: avifBytes(),
        loaderMime: 'image/jpeg',
        sniffedMime: 'image/avif',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toThrow(/avif image that can't be posted inline/);
  });

  it('classifies remote SVG (XML-declared, sniff application/xml) as a link', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: Buffer.from(SVG_XML),
        loaderMime: 'application/xml',
        sniffedMime: 'application/xml',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toEqual({ kind: 'link', effectiveMime: 'image/svg+xml' });
  });

  it('classifies remote UTF-16LE/BE BOM and DOCTYPE-prefixed SVG as a link', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    const le = concat(
      new Uint8Array([0xff, 0xfe]),
      utf16le('<svg xmlns="x"></svg>')
    );
    const be = concat(
      new Uint8Array([0xfe, 0xff]),
      utf16be('<svg xmlns="x"></svg>')
    );
    for (const buffer of [le, be, Buffer.from(SVG_DOCTYPE)]) {
      expect(
        classifyLoadedMedia({
          buffer,
          loaderMime: 'application/xml',
          sniffedMime: 'application/xml',
          isRemote: true,
          sourceLabel: 'x',
        })
      ).toEqual({ kind: 'link', effectiveMime: 'image/svg+xml' });
    }
  });

  it('throws convert-to-PNG for local SVG bytes', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(() =>
      classifyLoadedMedia({
        buffer: Buffer.from(SVG_XML),
        sniffedMime: 'application/xml',
        isRemote: false,
        sourceLabel: 'x',
      })
    ).toThrow(/convert it to PNG/);
  });

  it('does not treat non-SVG XML as SVG', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: Buffer.from(NON_SVG_XML),
        loaderMime: 'application/xml',
        sniffedMime: 'application/xml',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toEqual({ kind: 'link', effectiveMime: 'application/xml' });
  });

  it('classifies application/pdf as a link', async () => {
    const { classifyLoadedMedia } = await import('./upload.js');
    expect(
      classifyLoadedMedia({
        buffer: Buffer.from('%PDF-1.4 garbage'),
        loaderMime: 'application/pdf',
        sniffedMime: 'application/pdf',
        isRemote: true,
        sourceLabel: 'x',
      })
    ).toEqual({ kind: 'link', effectiveMime: 'application/pdf' });
  });
});

describe('prepareOutboundMedia (remote, mocked loader)', () => {
  let loadWebMedia: ReturnType<typeof vi.fn>;
  let uploadFile: ReturnType<typeof vi.fn>;
  let detectMime: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let savedHosting: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    const webMedia = await import('openclaw/plugin-sdk/web-media');
    const api = await import('@tloncorp/api');
    const mime = await import('openclaw/plugin-sdk/media-mime');
    loadWebMedia = vi.mocked(webMedia.loadWebMedia);
    uploadFile = vi.mocked(api.uploadFile);
    detectMime = vi.mocked(mime.detectMime);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    savedHosting = process.env.TLON_HOSTING;
    delete process.env.TLON_HOSTING;
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (savedHosting === undefined) {
      delete process.env.TLON_HOSTING;
    } else {
      process.env.TLON_HOSTING = savedHosting;
    }
  });

  function mockRemoteImage(contentType = 'image/png') {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(validPngBytes(10, 20)),
      contentType,
      kind: 'image',
    });
    detectMime.mockResolvedValue('image/png');
  }

  it('uploads a remote image and returns the uploaded URL + dims', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({ url: 'https://storage.example/u/img.png' });
    const { prepareOutboundMedia } = await import('./upload.js');
    const result = await prepareOutboundMedia('https://host/img.png', {});
    expect(result).toEqual({
      url: 'https://storage.example/u/img.png',
      isImage: true,
      width: 10,
      height: 20,
      contentType: 'image/png',
    });
  });

  it.each([
    [
      'a fetch-failed cause bearing a signed query',
      'Fetch failed https://host/img.png?sig=secret',
      ['sig=secret', 'secret', '?sig=', 'Fetch failed'],
    ],
    [
      'an uppercase-scheme cause bearing credentials and a signed query',
      'Fetch failed HTTPS://user:pass@host/img.png?X-Amz-Signature=secretvalue',
      ['user:pass', 'secretvalue', 'X-Amz-Signature', 'Fetch failed'],
    ],
    [
      'a malformed single-slash cause bearing credentials',
      'Fetch failed for https:/user:pass@host/img.png?sig=secret: timeout',
      ['user:pass', 'sig=secret', 'secret', 'Fetch failed', '[url removed]'],
    ],
    [
      'a scheme-less cause bearing a signed query',
      'request failed for /bucket/key?X-Amz-Signature=secretvalue',
      ['X-Amz-Signature', 'secretvalue', 'request failed', '/bucket/key'],
    ],
  ])(
    'uses a fixed category message for loader failures with %s (never interpolates raw cause)',
    async (_label, rawMessage, forbidden) => {
      loadWebMedia.mockRejectedValue(new Error(rawMessage));
      const { prepareOutboundMedia } = await import('./upload.js');
      const promise = prepareOutboundMedia('https://host/img.png', {});
      await expect(promise).rejects.toThrow(
        /Cannot read media "\[remote media reference\]": Failed to read media/
      );
      for (const s of forbidden) {
        await expect(promise).rejects.not.toThrow(s);
      }
      for (const call of logSpy.mock.calls) {
        for (const arg of call) {
          const str = String(arg);
          for (const s of forbidden) {
            expect(str).not.toContain(s);
          }
        }
      }
    }
  );

  it.each([
    ['not-found', 'Media file not found'],
    ['not-file', 'Media path is not a file'],
    ['path-not-allowed', 'Media path or file type is not allowed'],
    ['invalid-file-url', 'Invalid media path'],
    ['invalid-path', 'Invalid media path'],
    ['network-path-not-allowed', 'Invalid media path'],
    ['unsafe-bypass', 'Invalid media path'],
    ['invalid-root', 'Media access roots are misconfigured'],
    ['max_bytes', 'Media file is too large'],
    ['http_error', 'Media URL returned an HTTP error'],
    ['fetch_failed', 'Failed to fetch media'],
  ])(
    'maps the loader discriminator %s to its own fixed actionable phrase',
    async (code, phrase) => {
      const err = Object.assign(
        new Error('raw secret-bearing message ?sig=secretvalue'),
        { code }
      );
      loadWebMedia.mockRejectedValue(err);
      const { prepareOutboundMedia } = await import('./upload.js');
      const promise = prepareOutboundMedia('https://host/img.png', {});
      await expect(promise).rejects.toThrow(
        `Cannot read media "[remote media reference]": ${phrase}`
      );
      // The raw message is never interpolated, even though the discriminator is.
      await expect(promise).rejects.not.toThrow(/secretvalue/);
      await expect(promise).rejects.not.toThrow(/raw secret-bearing message/);
    }
  );

  it('falls back to the generic phrase for an unknown loader discriminator', async () => {
    const err = Object.assign(new Error('boom ?sig=secretvalue'), {
      code: 'some-future-code',
    });
    loadWebMedia.mockRejectedValue(err);
    const { prepareOutboundMedia } = await import('./upload.js');
    const promise = prepareOutboundMedia('https://host/img.png', {});
    await expect(promise).rejects.toThrow(/Failed to read media/);
    await expect(promise).rejects.not.toThrow(/some-future-code/);
    await expect(promise).rejects.not.toThrow(/secretvalue/);
  });

  it('posts a remote extensionless SVG as a link with svg content type', async () => {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(SVG_XML),
      contentType: 'application/xml',
      kind: 'image',
      fileName: 'blob',
    });
    detectMime.mockResolvedValue('application/xml');
    uploadFile.mockResolvedValue({ url: 'https://storage.example/u/blob.svg' });
    const { prepareOutboundMedia } = await import('./upload.js');
    const result = await prepareOutboundMedia('https://host/blob', {});
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'image/svg+xml',
        fileName: expect.stringMatching(/\.svg$/),
      })
    );
    expect(result.isImage).toBe(false);
    expect(result.url).toBe('https://storage.example/u/blob.svg');
    expect(result.contentType).toBe('image/svg+xml');
  });

  it('uses a synthetic filename for remote SVG bytes (never derives from pathname)', async () => {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(SVG_XML),
      contentType: 'application/xml',
      kind: 'image',
    });
    detectMime.mockResolvedValue('application/xml');
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/diagram.svg',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://host/diagram.xml', {});
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(/^upload-\d+\.svg$/),
      })
    );
  });

  it('rejects remote URLs with embedded credentials before any fetch', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    const promise = prepareOutboundMedia(
      'https://user:pass@host/img.png?sig=secret',
      {}
    );
    await expect(promise).rejects.toThrow(
      'Media URLs with embedded credentials are not supported'
    );
    // The thrown message must not echo the raw credentialed URL, the username,
    // the password, or the signed query at all.
    await expect(promise).rejects.not.toThrow(/user:pass@host/);
    await expect(promise).rejects.not.toThrow(/user/);
    await expect(promise).rejects.not.toThrow(/pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    expect(loadWebMedia).not.toHaveBeenCalled();
    // Every argument of every console.log call must be free of the credentials
    // and signed query (not just a single argument string).
    for (const call of logSpy.mock.calls) {
      for (const arg of call) {
        const s = String(arg);
        expect(s).not.toContain('user:pass@host');
        expect(s).not.toContain('sig=secret');
      }
    }
  });

  it('throws a generic error for a malformed https-prefixed URL (no raw ERR_INVALID_URL leak)', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    const malformed = 'https://user:pass@host:bad/img.png?sig=secret';
    const promise = prepareOutboundMedia(malformed, {});
    await expect(promise).rejects.toThrow('Invalid media URL');
    await expect(promise).rejects.not.toThrow(/user/);
    await expect(promise).rejects.not.toThrow(/pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    await expect(promise).rejects.not.toThrow(/ERR_INVALID_URL/);
    await expect(promise).rejects.not.toThrow(/bad/);
    expect(loadWebMedia).not.toHaveBeenCalled();
  });

  it('throws a generic error for a malformed file:// URL bearing credentials and a query secret (no raw leak)', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    const malformed = 'file://user:pass@host:bad/img.png?sig=secret';
    const promise = prepareOutboundMedia(malformed, {});
    await expect(promise).rejects.toThrow('Invalid media URL');
    await expect(promise).rejects.not.toThrow(/user/);
    await expect(promise).rejects.not.toThrow(/pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    await expect(promise).rejects.not.toThrow(/secret/);
    await expect(promise).rejects.not.toThrow(/file:\/\//);
    await expect(promise).rejects.not.toThrow(/ERR_INVALID_URL/);
    expect(loadWebMedia).not.toHaveBeenCalled();
  });

  it('treats a noncanonical single-slash https:/ input as a local path (no authority form, no raw leak)', async () => {
    // A single slash is not the `://` authority form, so the narrowed scheme
    // guard leaves it for the root-allowlisted loader; the output-side
    // placeholder label + fixed category phrase keep it from leaking.
    loadWebMedia.mockRejectedValue(new Error('ENOENT'));
    const { prepareOutboundMedia } = await import('./upload.js');
    const malformed = 'https:/user:pass@host/img.png?sig=secret';
    const promise = prepareOutboundMedia(malformed, {});
    await expect(promise).rejects.toThrow(/Cannot read media/);
    await expect(promise).rejects.toThrow(/\[local media reference\]/);
    await expect(promise).rejects.not.toThrow('Invalid media URL');
    await expect(promise).rejects.not.toThrow(/user/);
    await expect(promise).rejects.not.toThrow(/pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    await expect(promise).rejects.not.toThrow(/secret/);
    await expect(promise).rejects.not.toThrow(/host/);
    await expect(promise).rejects.not.toThrow(/https:\//);
    expect(loadWebMedia).toHaveBeenCalled();
  });

  it('treats a colon-bearing local filename (report:2026.png) as a local path, not a scheme', async () => {
    // A bare `<word>:<rest>` without `//` is an ordinary workspace-relative
    // path; the guard must not reject it, leaving the loader to resolve it
    // against the allowlisted roots.
    loadWebMedia.mockRejectedValue(new Error('ENOENT'));
    const { prepareOutboundMedia } = await import('./upload.js');
    const promise = prepareOutboundMedia('report:2026.png', {});
    await expect(promise).rejects.toThrow(/Cannot read media/);
    await expect(promise).rejects.not.toThrow('Invalid media URL');
    expect(loadWebMedia).toHaveBeenCalledWith(
      'report:2026.png',
      expect.anything()
    );
  });

  it('rejects an other-scheme (ftp://) credentialed URL before any loader call (no raw leak)', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    const malformed = 'ftp://user:pass@host/img.png?sig=secret';
    const promise = prepareOutboundMedia(malformed, {});
    await expect(promise).rejects.toThrow('Invalid media URL');
    await expect(promise).rejects.not.toThrow(/user/);
    await expect(promise).rejects.not.toThrow(/pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    await expect(promise).rejects.not.toThrow(/secret/);
    await expect(promise).rejects.not.toThrow(/host/);
    await expect(promise).rejects.not.toThrow(/ftp:\/\//);
    expect(loadWebMedia).not.toHaveBeenCalled();
  });

  it('does not reject a legitimate media:// reference (passes it to the loader unchanged)', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({ url: 'https://storage.example/u/img.png' });
    const { prepareOutboundMedia } = await import('./upload.js');
    const result = await prepareOutboundMedia('media://some-opaque-token', {});
    expect(loadWebMedia).toHaveBeenCalledWith(
      'media://some-opaque-token',
      expect.anything()
    );
    expect(result.url).toBe('https://storage.example/u/img.png');
  });

  it('falls back to the full signed URL on remote https upload failure', async () => {
    mockRemoteImage();
    uploadFile.mockRejectedValue(
      new Error(
        'Upload failed: https://storage.example.com/bucket/key?X-Amz-Signature=secretvalue'
      )
    );
    const { prepareOutboundMedia } = await import('./upload.js');
    const result = await prepareOutboundMedia(
      'https://host/img.png?sig=secret',
      {}
    );
    expect(result.url).toBe('https://host/img.png?sig=secret');
    expect(result.url).toContain('sig=secret');
    expect(result.isImage).toBe(true);
    // The log uses a fixed category phrase — the raw cause is never logged.
    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      for (const arg of call) {
        const s = String(arg);
        expect(s).not.toContain('secretvalue');
        expect(s).not.toContain('X-Amz-Signature');
        expect(s).not.toContain('Upload failed:');
      }
    }
  });

  it('rejects on remote http upload failure (mixed content)', async () => {
    mockRemoteImage();
    uploadFile.mockRejectedValue(new Error('upload boom'));
    const { prepareOutboundMedia } = await import('./upload.js');
    await expect(
      prepareOutboundMedia('http://host/img.png', {})
    ).rejects.toThrow(/Failed to upload media/);
  });

  it.each([
    ['http://insecure/x.png'],
    ['/relative/path.png'],
    ['https://user:pass@host/x.png'],
  ])(
    'treats an invalid uploaded URL %s as an upload failure',
    async (badUrl) => {
      mockRemoteImage();
      uploadFile.mockResolvedValue({ url: badUrl });
      const { prepareOutboundMedia } = await import('./upload.js');
      // https source falls back to hotlinking the original.
      const result = await prepareOutboundMedia('https://host/img.png', {});
      expect(result.url).toBe('https://host/img.png');
      // The invalid uploaded URL — especially the credentialed one — must never
      // be echoed into any log argument.
      for (const call of logSpy.mock.calls) {
        for (const arg of call) {
          const s = String(arg);
          expect(s).not.toContain('user:pass');
          expect(s).not.toContain(badUrl);
        }
      }
    }
  );

  it('treats an uploaded URL with a fragment as invalid', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({ url: 'https://storage.example/key#frag' });
    const { prepareOutboundMedia } = await import('./upload.js');
    const result = await prepareOutboundMedia('https://host/img.png', {});
    expect(result.url).toBe('https://host/img.png');
  });

  it('ignores a secret-bearing loader fileName for remote sources', async () => {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(validPngBytes(10, 20)),
      contentType: 'image/png',
      kind: 'image',
      fileName: 'evil<>.png?x=1',
    });
    detectMime.mockResolvedValue('image/png');
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/photo.png',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://host/photo.png', {});
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(/^upload-\d+\.png$/),
      })
    );
  });

  it('generates a filename when the remote pathname is empty', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/upload.png',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://host/?sig=secret', {});
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(/^upload-\d+\.png$/),
      })
    );
  });

  it('uses a synthetic filename for a percent-encoded remote pathname (never derives from URL)', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/a-23b.png',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://host/a%23b.png', {});
    const fileName = uploadFile.mock.calls[0][0].fileName as string;
    expect(fileName).toMatch(/^upload-\d+\.png$/);
    expect(fileName).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('strips the MEDIA: prefix for remote URLs', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({ url: 'https://storage.example/u/img.png' });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('MEDIA:https://host/img.png', {});
    expect(loadWebMedia).toHaveBeenCalledWith(
      'https://host/img.png',
      expect.anything()
    );
  });

  it('passes hostedDetection when TLON_HOSTING is set, and omits it otherwise', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({ url: 'https://storage.example/u/img.png' });
    const { prepareOutboundMedia } = await import('./upload.js');

    process.env.TLON_HOSTING = '1';
    await prepareOutboundMedia('https://host/img.png', {});
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ hostedDetection: 'assume-hosted' })
    );

    uploadFile.mockClear();
    delete process.env.TLON_HOSTING;
    await prepareOutboundMedia('https://host/img.png', {});
    expect(uploadFile.mock.calls[0][0]).not.toHaveProperty('hostedDetection');
  });

  it.each([
    ['ws://user:pass@host/path?sig=secret'],
    ['s3://user:pass@host/path?sig=secret'],
  ])(
    'rejects a short-scheme (%s) credentialed URL before any loader call',
    async (url) => {
      const { prepareOutboundMedia } = await import('./upload.js');
      const promise = prepareOutboundMedia(url, {});
      await expect(promise).rejects.toThrow('Invalid media URL');
      await expect(promise).rejects.not.toThrow(/user:pass/);
      await expect(promise).rejects.not.toThrow(/sig=secret/);
      await expect(promise).rejects.not.toThrow(/secret/);
      expect(loadWebMedia).not.toHaveBeenCalled();
    }
  );

  it.each([['C:\\Users\\test\\image.png'], ['C:/Users/test/image.png']])(
    'treats a Windows drive path (%s) as an ordinary local path, not a scheme',
    async (drivePath) => {
      loadWebMedia.mockRejectedValue(new Error('ENOENT'));
      const { prepareOutboundMedia } = await import('./upload.js');
      const promise = prepareOutboundMedia(drivePath, {});
      await expect(promise).rejects.toThrow(/Cannot read media/);
      await expect(promise).rejects.not.toThrow('Invalid media URL');
      expect(loadWebMedia).toHaveBeenCalled();
    }
  );

  it('sanitizes credentials from a malformed media:// reference in the error message', async () => {
    loadWebMedia.mockRejectedValue(new Error('unresolvable media reference'));
    const { prepareOutboundMedia } = await import('./upload.js');
    const promise = prepareOutboundMedia(
      'media://user:pass@inbound/id?sig=secret',
      {}
    );
    await expect(promise).rejects.toThrow(/Cannot read media/);
    await expect(promise).rejects.not.toThrow(/user:pass/);
    await expect(promise).rejects.not.toThrow(/sig=secret/);
    await expect(promise).rejects.not.toThrow(/secret/);
  });

  it.each([
    [
      'an ordinary local path',
      '/workspace/images/photo.png',
      ['photo.png', '/workspace'],
    ],
    [
      'a credential-bearing path',
      './https://user:pass@host/path?sig=secret',
      ['user:pass', 'sig=secret', 'host'],
    ],
    [
      'an @-bearing single-char-scheme path',
      './x://u:p@host/path',
      ['u:p@host', 'x://', 'host'],
    ],
    [
      'a #-fragment path',
      './path#X-Amz-Signature=secretvalue',
      ['X-Amz-Signature', 'secretvalue'],
    ],
    [
      'a percent-encoded path',
      './file%3Fsig=secretvalue.png',
      ['secretvalue', 'sig='],
    ],
    [
      'a ?sig= query path',
      './photo.png?sig=secretvalue',
      ['sig=secretvalue', 'secretvalue'],
    ],
  ])(
    'uses the fixed [local media reference] placeholder for %s (never echoes the path)',
    async (_label, input, forbidden) => {
      loadWebMedia.mockRejectedValue(new Error('ENOENT: no such file'));
      const { prepareOutboundMedia } = await import('./upload.js');
      const promise = prepareOutboundMedia(input, {});
      await expect(promise).rejects.toThrow(/Cannot read media/);
      await expect(promise).rejects.toThrow(/\[local media reference\]/);
      for (const s of forbidden) {
        await expect(promise).rejects.not.toThrow(s);
      }
    }
  );

  it('uses a synthetic filename for remote sources (never derives from URL pathname)', async () => {
    mockRemoteImage();
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/file.png',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://host/path/file@name.png', {});
    const fileName = uploadFile.mock.calls[0][0].fileName as string;
    expect(fileName).toMatch(/^upload-\d+\.png$/);
    expect(fileName).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('never leaks a secret-bearing remote path segment into error text or the uploaded filename', async () => {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(validPngBytes(10, 20)),
      contentType: 'image/png',
      kind: 'image',
    });
    detectMime.mockResolvedValue('image/png');
    uploadFile.mockRejectedValue(new Error('upload boom'));
    const { prepareOutboundMedia } = await import('./upload.js');
    const promise = prepareOutboundMedia(
      'http://cdn.example/tok-SECRETVALUE.png',
      {}
    );
    await expect(promise).rejects.toThrow(/Failed to upload media/);
    await expect(promise).rejects.not.toThrow(/SECRETVALUE/);
    await expect(promise).rejects.not.toThrow(/tok-SECRETVALUE/);
    await expect(promise).rejects.not.toThrow(/cdn\.example/);
    for (const call of logSpy.mock.calls) {
      for (const arg of call) {
        const s = String(arg);
        expect(s).not.toContain('SECRETVALUE');
        expect(s).not.toContain('tok-SECRETVALUE');
      }
    }
  });

  it('uses a synthetic upload filename with no part of the remote path on the upload path', async () => {
    loadWebMedia.mockResolvedValue({
      buffer: Buffer.from(validPngBytes(10, 20)),
      contentType: 'image/png',
      kind: 'image',
    });
    detectMime.mockResolvedValue('image/png');
    uploadFile.mockResolvedValue({
      url: 'https://storage.example/u/x.png',
    });
    const { prepareOutboundMedia } = await import('./upload.js');
    await prepareOutboundMedia('https://cdn.example/tok-SECRETVALUE.png', {});
    const fileName = uploadFile.mock.calls[0][0].fileName as string;
    expect(fileName).toMatch(/^upload-\d+\.png$/);
    expect(fileName).not.toContain('SECRETVALUE');
    expect(fileName).not.toContain('tok');
    expect(fileName).not.toContain('cdn');
  });
});
