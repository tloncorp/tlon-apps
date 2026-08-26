import { describe, expect, it } from 'bun:test';

import {
  IMAGE_GUARD_OPTIONS,
  assertPostableImageUrl,
  fetchImageVerse,
  imageDimensions,
  imageFlagIndex,
  imageFlagValue,
  validatedImageFlag,
} from './image-attach';
import {
  HTTPS_ONLY_ERROR,
  INVALID_MEDIA_ERROR,
  LOCAL_MEDIA_ERROR,
  USERINFO_ERROR,
} from './media-guard';

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      for (const ch of part) out.push(ch.charCodeAt(0));
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out);
}

const PNG_2X3 = bytes(
  [0x89],
  'PNG',
  [0x0d, 0x0a, 0x1a, 0x0a],
  [0x00, 0x00, 0x00, 0x0d],
  'IHDR',
  [0x00, 0x00, 0x00, 0x02], // width 2
  [0x00, 0x00, 0x00, 0x03] // height 3
);

describe('imageDimensions', () => {
  it('parses PNG IHDR', () => {
    expect(imageDimensions(PNG_2X3)).toEqual({ width: 2, height: 3 });
  });

  it('parses GIF logical screen descriptor', () => {
    const gif = bytes('GIF89a', [0x04, 0x00, 0x05, 0x00]); // 4x5 LE
    expect(imageDimensions(gif)).toEqual({ width: 4, height: 5 });
  });

  it('parses JPEG SOF0 after skipping segments', () => {
    const jpeg = bytes(
      [0xff, 0xd8], // SOI
      [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00], // APP0, segLen 4
      [0xff, 0xc0, 0x00, 0x11, 0x08], // SOF0, segLen, precision
      [0x00, 0x07], // height 7
      [0x00, 0x09], // width 9
      [0x00, 0x00, 0x00] // padding so SOF fields are in range
    );
    expect(imageDimensions(jpeg)).toEqual({ width: 9, height: 7 });
  });

  it('parses WebP VP8L', () => {
    // width 10, height 20 → bits = (10-1) | ((20-1) << 14)
    const dims = 9 | (19 << 14);
    const webp = bytes(
      'RIFF',
      [0x00, 0x00, 0x00, 0x00],
      'WEBP',
      'VP8L',
      [0x00, 0x00, 0x00, 0x00],
      [0x2f],
      [
        dims & 0xff,
        (dims >> 8) & 0xff,
        (dims >> 16) & 0xff,
        (dims >> 24) & 0xff,
      ],
      [0x00, 0x00, 0x00, 0x00, 0x00] // pad past the 30-byte container guard
    );
    expect(imageDimensions(webp)).toEqual({ width: 10, height: 20 });
  });

  it('parses WebP VP8X extended header', () => {
    const webp = bytes(
      'RIFF',
      [0x00, 0x00, 0x00, 0x00],
      'WEBP',
      'VP8X',
      [0x0a, 0x00, 0x00, 0x00],
      [0x00, 0x00, 0x00, 0x00], // flags + reserved
      [0x63, 0x00, 0x00], // width-1 = 99
      [0x31, 0x00, 0x00] // height-1 = 49
    );
    expect(imageDimensions(webp)).toEqual({ width: 100, height: 50 });
  });

  it('returns null for non-image bytes and truncated headers', () => {
    expect(
      imageDimensions(bytes('hello world this is not an image'))
    ).toBeNull();
    expect(imageDimensions(PNG_2X3.subarray(0, 12))).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8, 0xff, 0xd9]))).toBeNull(); // EOI before SOF
  });
});

describe('image guard budget', () => {
  it('applies the outbound-media contract limits', () => {
    expect(IMAGE_GUARD_OPTIONS).toEqual({
      maxBytes: 10 * 1024 * 1024,
      deadlineMs: 30_000,
      maxRedirects: 3,
      requireHttps: true,
    });
  });
});

describe('fetchImageVerse', () => {
  function fetcherReturning(body: Uint8Array) {
    const calls: string[] = [];
    return {
      calls,
      fetchImage: async (url: string) => {
        calls.push(url);
        return { bytes: body };
      },
    };
  }

  it('builds a story image block with sniffed dimensions and alt', async () => {
    const fetcher = fetcherReturning(PNG_2X3);
    const verse = await fetchImageVerse(
      'https://storage.example.com/~zod/tree%20pic.png',
      fetcher.fetchImage
    );
    expect(verse).toEqual({
      block: {
        image: {
          src: 'https://storage.example.com/~zod/tree%20pic.png',
          width: 2,
          height: 3,
          alt: 'tree pic.png',
        },
      },
    });
    expect(fetcher.calls).toEqual([
      'https://storage.example.com/~zod/tree%20pic.png',
    ]);
  });

  it('fetches and posts the canonical URL, never the raw input', async () => {
    const fetcher = fetcherReturning(PNG_2X3);
    const verse = await fetchImageVerse(
      '  HTTPS://Storage.Example.com/a.png  ',
      fetcher.fetchImage
    );
    expect(fetcher.calls).toEqual(['https://storage.example.com/a.png']);
    expect(
      (verse as { block: { image: { src: string } } }).block.image.src
    ).toBe('https://storage.example.com/a.png');
  });

  it('throws when dimensions cannot be determined', async () => {
    const fetcher = fetcherReturning(bytes('<html>not an image</html>'));
    await expect(
      fetchImageVerse('https://x.example/page.html', fetcher.fetchImage)
    ).rejects.toThrow(/Could not determine image dimensions/);
  });

  it('classifies before fetching — rejections never touch the network', async () => {
    const cases: Array<[string, string]> = [
      ['/pier/generated.png', LOCAL_MEDIA_ERROR],
      ['file:///pier/generated.png', LOCAL_MEDIA_ERROR],
      ['~/generated.png', LOCAL_MEDIA_ERROR],
      ['C:\\generated.png', LOCAL_MEDIA_ERROR],
      ['http://x.example/y.png', HTTPS_ONLY_ERROR],
      ['https://user:pw@x.example/y.png', USERINFO_ERROR],
      ['https://@x.example/y.png', USERINFO_ERROR],
      ['ftp://x.example/y.png', INVALID_MEDIA_ERROR],
      ['y.png', INVALID_MEDIA_ERROR],
      ['garbage', INVALID_MEDIA_ERROR],
    ];

    for (const [input, expected] of cases) {
      const fetcher = fetcherReturning(PNG_2X3);
      await expect(fetchImageVerse(input, fetcher.fetchImage)).rejects.toThrow(
        expected
      );
      expect(fetcher.calls).toEqual([]);
    }
  });

  it('never echoes the caller URL into an error message', () => {
    let message = '';
    try {
      assertPostableImageUrl('http://x.example/y.png?token=SUPERSECRET');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(HTTPS_ONLY_ERROR);
    expect(message).not.toContain('SUPERSECRET');
  });
});

describe('image flag parsing', () => {
  it('accepts separated and equals image flags and returns the canonical URL', () => {
    expect(
      validatedImageFlag(
        ['posts', 'send', '~sampel', '--image', 'https://x.example/y.png'],
        'usage'
      )
    ).toBe('https://x.example/y.png');
    expect(
      validatedImageFlag(
        ['posts', 'send', '~sampel', '--image=HTTPS://X.example/y.png'],
        'usage'
      )
    ).toBe('https://x.example/y.png');
  });

  it('returns undefined when the flag is absent', () => {
    expect(
      validatedImageFlag(['posts', 'send', '~sampel', 'hi'], 'usage')
    ).toBe(undefined);
  });

  it('throws a usage error when the flag value is missing', () => {
    expect(() =>
      validatedImageFlag(['posts', 'send', '~sampel', '--image'], 'usage')
    ).toThrow();
  });

  it('applies the media contract to the flag value', () => {
    expect(() =>
      validatedImageFlag(
        ['posts', 'send', '~sampel', '--image', '/pier/x.png'],
        'usage'
      )
    ).toThrow(LOCAL_MEDIA_ERROR);
    expect(() =>
      validatedImageFlag(
        ['posts', 'send', '~sampel', '--image=http://x.example/y.png'],
        'usage'
      )
    ).toThrow(HTTPS_ONLY_ERROR);
  });

  it('finds equals image flags for message boundary parsing', () => {
    const args = [
      'posts',
      'send',
      '~sampel',
      'caption',
      '--image=https://x.example/y.png',
    ];

    const idx = imageFlagIndex(args);

    expect(idx).toBe(4);
    expect(imageFlagValue(args, 'usage')).toBe('https://x.example/y.png');
  });
});
