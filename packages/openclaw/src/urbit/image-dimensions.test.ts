import { describe, expect, it } from 'vitest';

import { parseRasterHeader } from './image-dimensions.js';
import {
  gifBytes,
  jpegBytes,
  pngHeaderBytes,
  validPngBytes,
  webpBytes,
} from './test-fixtures.js';

describe('parseRasterHeader', () => {
  it('parses a structurally complete PNG header', () => {
    expect(parseRasterHeader(pngHeaderBytes(10, 20))).toEqual({
      format: 'png',
      width: 10,
      height: 20,
    });
  });

  it('parses a genuine complete PNG (validPngBytes) with real dimensions', () => {
    expect(parseRasterHeader(validPngBytes())).toEqual({
      format: 'png',
      width: 1,
      height: 1,
    });
    expect(parseRasterHeader(validPngBytes(5, 3))).toEqual({
      format: 'png',
      width: 5,
      height: 3,
    });
  });

  it('parses GIF87a and GIF89a', () => {
    expect(parseRasterHeader(gifBytes(10, 20, 'GIF87a'))).toEqual({
      format: 'gif',
      width: 10,
      height: 20,
    });
    expect(parseRasterHeader(gifBytes(300, 150, 'GIF89a'))).toEqual({
      format: 'gif',
      width: 300,
      height: 150,
    });
  });

  it('parses a structurally complete JPEG SOF segment (SOF walk)', () => {
    expect(parseRasterHeader(jpegBytes(10, 20))).toEqual({
      format: 'jpeg',
      width: 10,
      height: 20,
    });
  });

  it('parses WebP VP8, VP8L, and VP8X', () => {
    expect(
      parseRasterHeader(webpBytes({ variant: 'VP8 ', width: 10, height: 20 }))
    ).toEqual({ format: 'webp', width: 10, height: 20 });
    expect(
      parseRasterHeader(webpBytes({ variant: 'VP8L', width: 10, height: 20 }))
    ).toEqual({ format: 'webp', width: 10, height: 20 });
    expect(
      parseRasterHeader(webpBytes({ variant: 'VP8X', width: 10, height: 20 }))
    ).toEqual({ format: 'webp', width: 10, height: 20 });
  });

  it('returns null for truncated/incomplete magic', () => {
    // "GIF8" alone (no 7a/9a, no descriptor).
    expect(
      parseRasterHeader(new Uint8Array([0x47, 0x49, 0x46, 0x38]))
    ).toBeNull();
    // PNG missing the signature tail (only the first 4 bytes).
    expect(
      parseRasterHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    ).toBeNull();
    // PNG with a corrupted signature tail byte.
    const badTail = pngHeaderBytes(10, 20);
    badTail[7] = 0x00;
    expect(parseRasterHeader(badTail)).toBeNull();
  });

  it('returns null for a PNG IHDR length != 13', () => {
    expect(parseRasterHeader(pngHeaderBytes(10, 20, 14))).toBeNull();
  });

  it('returns null when the declared IHDR/descriptor length exceeds the buffer', () => {
    // 24-byte PNG: 8 sig + 4 length + 4 'IHDR' + only 8 of the 13 declared IHDR
    // data bytes and no CRC. The length field still says 13, but the buffer does
    // not actually contain the full chunk, so it must be rejected.
    const truncatedPng = pngHeaderBytes(10, 20).slice(0, 24);
    expect(truncatedPng.length).toBe(24);
    expect(parseRasterHeader(truncatedPng)).toBeNull();
    // 10-byte GIF: 6-byte signature + only 4 of the 7 logical-screen-descriptor
    // bytes. The full 13 bytes must be present before reading width/height.
    const truncatedGif = gifBytes(10, 20).slice(0, 10);
    expect(truncatedGif.length).toBe(10);
    expect(parseRasterHeader(truncatedGif)).toBeNull();
  });

  it('returns null for malformed WebP length fields', () => {
    // RIFF size 0.
    expect(
      parseRasterHeader(
        webpBytes({ variant: 'VP8X', width: 10, height: 20, riffSize: 0 })
      )
    ).toBeNull();
    // Oversized RIFF size sentinel.
    expect(
      parseRasterHeader(
        webpBytes({
          variant: 'VP8X',
          width: 10,
          height: 20,
          riffSize: 0xffffffff,
        })
      )
    ).toBeNull();
    // VP8X chunk size != 10.
    expect(
      parseRasterHeader(
        webpBytes({ variant: 'VP8X', width: 10, height: 20, chunkSize: 9 })
      )
    ).toBeNull();
    // Variant chunk whose padded end crosses the RIFF boundary.
    expect(
      parseRasterHeader(
        webpBytes({ variant: 'VP8X', width: 10, height: 20, riffSize: 14 })
      )
    ).toBeNull();
  });

  it('returns null for a JPEG SOF with a short length', () => {
    expect(
      parseRasterHeader(jpegBytes(10, 20, { components: 3, segLen: 10 }))
    ).toBeNull();
  });

  it('returns null for a JPEG SOF with components=0 / length 8', () => {
    // FF D8 FF C0 00 08 08 00 01 00 01 00 — satisfies length == 8 + 0*3 but is
    // structurally invalid (a decoder needs >= 1 component).
    expect(
      parseRasterHeader(jpegBytes(1, 1, { components: 0, segLen: 8 }))
    ).toBeNull();
  });

  it('returns null for unrecognized bytes', () => {
    expect(
      parseRasterHeader(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    ).toBeNull();
    expect(parseRasterHeader(new Uint8Array([]))).toBeNull();
  });
});
