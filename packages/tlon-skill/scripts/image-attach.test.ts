import { describe, expect, it } from 'bun:test';

import { fetchImageVerse, imageDimensions } from './image-attach';

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
      [dims & 0xff, (dims >> 8) & 0xff, (dims >> 16) & 0xff, (dims >> 24) & 0xff],
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
    expect(imageDimensions(bytes('hello world this is not an image'))).toBeNull();
    expect(imageDimensions(PNG_2X3.subarray(0, 12))).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8, 0xff, 0xd9]))).toBeNull(); // EOI before SOF
  });
});

describe('fetchImageVerse', () => {
  const fetchReturning = (body: Uint8Array, ok = true, status = 200) =>
    (async () => ({
      ok,
      status,
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    })) as unknown as typeof fetch;

  it('builds a story image block with sniffed dimensions and alt', async () => {
    const verse = await fetchImageVerse(
      'https://storage.example.com/~zod/tree%20pic.png',
      fetchReturning(PNG_2X3)
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
  });

  it('throws on a non-OK response', async () => {
    await expect(
      fetchImageVerse('https://x.example/img.png', fetchReturning(PNG_2X3, false, 404))
    ).rejects.toThrow('Failed to fetch image: 404');
  });

  it('throws when dimensions cannot be determined', async () => {
    await expect(
      fetchImageVerse('https://x.example/page.html', fetchReturning(bytes('<html>not an image</html>')))
    ).rejects.toThrow(/Could not determine image dimensions/);
  });
});
