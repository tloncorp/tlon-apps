import { describe, expect, it } from 'vitest';

import { parseRasterHeader } from './image-dimensions.js';
import {
  gifBytes,
  gifEmptyImageDataBytes,
  gifNoImageDescriptorBytes,
  gifWithExtensionBytes,
  jpegBytes,
  jpegEmptyScanBytes,
  jpegMultiScanBytes,
  jpegNoScanBytes,
  jpegPostEoiPaddingBytes,
  jpegRestartStuffingBytes,
  pngHeaderBytes,
  realBaselineJpegBytes,
  realProgressiveJpegBytes,
  realWebpAnimatedBytes,
  realWebpLosslessBytes,
  realWebpLossyBytes,
  realWebpVp8xStaticBytes,
  validGifBytes,
  validPngBytes,
  webpBytes,
  webpVp8xAnimationBytes,
  webpVp8xAnmfTrailingGarbageBytes,
  webpVp8xEmptyAnmfBytes,
  webpVp8xEmptyAnmfThenValidBytes,
  webpVp8xEmptyVp8Bytes,
} from './test-fixtures.js';

describe('parseRasterHeader', () => {
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

  it('parses a genuine complete GIF (validGifBytes) with real dimensions', () => {
    expect(parseRasterHeader(validGifBytes())).toEqual({
      format: 'gif',
      width: 1,
      height: 1,
    });
    expect(parseRasterHeader(validGifBytes(10, 20))).toEqual({
      format: 'gif',
      width: 10,
      height: 20,
    });
  });

  it('parses a GIF with an extension block before the image descriptor', () => {
    expect(parseRasterHeader(gifWithExtensionBytes(8, 4))).toEqual({
      format: 'gif',
      width: 8,
      height: 4,
    });
  });

  it('parses genuine encoder-produced JPEGs (baseline + progressive) with real dimensions', () => {
    expect(parseRasterHeader(realBaselineJpegBytes())).toEqual({
      format: 'jpeg',
      width: 2,
      height: 3,
    });
    expect(parseRasterHeader(realProgressiveJpegBytes())).toEqual({
      format: 'jpeg',
      width: 4,
      height: 2,
    });
  });

  function findSof0Offset(bytes: Uint8Array): number {
    for (let i = 0; i + 1 < bytes.length; i += 1) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xc0) {
        return i;
      }
    }
    throw new Error('SOF0 marker not found');
  }

  function findEoiOffset(bytes: Uint8Array): number {
    for (let i = bytes.length - 2; i >= 0; i -= 1) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        return i;
      }
    }
    throw new Error('EOI marker not found');
  }

  it('rejects any JPEG carrying a DNL marker (libjpeg-turbo cannot honor it)', () => {
    // Zero-SOF-height + DNL: rejected — libjpeg-turbo (Android/Chromium)
    // reports zero-height SOF as "DNL not supported".
    const base = realBaselineJpegBytes();
    const sofOff = findSof0Offset(base);
    const zeroSof = new Uint8Array(base.length + 6);
    zeroSof.set(base.subarray(0, sofOff + 5), 0);
    zeroSof[sofOff + 5] = 0x00;
    zeroSof[sofOff + 6] = 0x00;
    zeroSof.set(base.subarray(sofOff + 7), sofOff + 7);
    const eoiOff = findEoiOffset(zeroSof);
    const withDnl = new Uint8Array(zeroSof.length + 6);
    withDnl.set(zeroSof.subarray(0, eoiOff), 0);
    withDnl.set([0xff, 0xdc, 0x00, 0x04, 0x00, 0x03], eoiOff);
    withDnl.set(zeroSof.subarray(eoiOff), eoiOff + 6);
    expect(parseRasterHeader(withDnl)).toBeNull();

    // Nonzero SOF + conflicting small DNL: rejected — libjpeg-turbo ignores the
    // DNL and decodes at the SOF height, so reporting the DNL height would let
    // an oversized image pass the pixel bounds.
    const eoiOff2 = findEoiOffset(base);
    const conflicting = new Uint8Array(base.length + 6);
    conflicting.set(base.subarray(0, eoiOff2), 0);
    conflicting.set([0xff, 0xdc, 0x00, 0x04, 0x00, 0x01], eoiOff2);
    conflicting.set(base.subarray(eoiOff2), eoiOff2 + 6);
    expect(parseRasterHeader(conflicting)).toBeNull();
  });

  it('returns null for a zero-SOF-height JPEG without DNL', () => {
    const base = realBaselineJpegBytes();
    const sofOff = findSof0Offset(base);
    const mutated = new Uint8Array(base.length);
    mutated.set(base);
    mutated[sofOff + 5] = 0x00;
    mutated[sofOff + 6] = 0x00;
    expect(parseRasterHeader(mutated)).toBeNull();
  });

  it('parses a complete JPEG with post-EOI padding (regression: no false-reject)', () => {
    expect(parseRasterHeader(jpegPostEoiPaddingBytes())).toEqual({
      format: 'jpeg',
      width: 1,
      height: 1,
    });
    expect(parseRasterHeader(jpegPostEoiPaddingBytes(10, 20))).toEqual({
      format: 'jpeg',
      width: 10,
      height: 20,
    });
  });

  it('parses a JPEG whose scan contains 0xFF00 stuffing and a restart marker', () => {
    expect(parseRasterHeader(jpegRestartStuffingBytes(4, 6))).toEqual({
      format: 'jpeg',
      width: 4,
      height: 6,
    });
  });

  it('parses a multi-scan JPEG', () => {
    expect(parseRasterHeader(jpegMultiScanBytes(7, 5))).toEqual({
      format: 'jpeg',
      width: 7,
      height: 5,
    });
  });

  it('parses genuine encoder-produced WebPs (VP8, VP8L, VP8X static, animated) with real dimensions', () => {
    expect(parseRasterHeader(realWebpLossyBytes())).toEqual({
      format: 'webp',
      width: 5,
      height: 4,
    });
    expect(parseRasterHeader(realWebpLosslessBytes())).toEqual({
      format: 'webp',
      width: 5,
      height: 4,
    });
    expect(parseRasterHeader(realWebpVp8xStaticBytes())).toEqual({
      format: 'webp',
      width: 7,
      height: 3,
    });
    expect(parseRasterHeader(realWebpAnimatedBytes())).toEqual({
      format: 'webp',
      width: 6,
      height: 5,
    });
  });

  it('returns null for a VP8X-only WebP with no image-data chunk', () => {
    expect(
      parseRasterHeader(webpBytes({ variant: 'VP8X', width: 10, height: 20 }))
    ).toBeNull();
  });

  it('returns null for a VP8X WebP followed by an empty VP8 chunk', () => {
    expect(parseRasterHeader(webpVp8xEmptyVp8Bytes(10, 20))).toBeNull();
  });

  it('returns null for a VP8X WebP followed by an empty ANMF chunk', () => {
    expect(parseRasterHeader(webpVp8xEmptyAnmfBytes(10, 20))).toBeNull();
  });

  it('returns null for a VP8X animation with an empty ANMF followed by a valid ANMF', () => {
    expect(parseRasterHeader(webpVp8xEmptyAnmfThenValidBytes(6, 5))).toBeNull();
  });

  it('returns null for a VP8X animation whose ANMF has a valid VP8L plus trailing garbage', () => {
    expect(
      parseRasterHeader(webpVp8xAnmfTrailingGarbageBytes(6, 5))
    ).toBeNull();
  });

  it('returns null for a VP8X WebP with the animation flag set but no ANIM chunk', () => {
    expect(parseRasterHeader(webpVp8xAnimationBytes(10, 20))).toBeNull();
  });

  it('returns null for a header-only PNG (no IDAT/IEND)', () => {
    expect(parseRasterHeader(pngHeaderBytes(10, 20))).toBeNull();
  });

  it('returns null for a PNG with IDAT but missing IEND', () => {
    const full = validPngBytes(4, 4);
    const iendOffset = full.length - 12;
    const noIend = full.slice(0, iendOffset);
    expect(parseRasterHeader(noIend)).toBeNull();
  });

  it('returns null for a header-only GIF (no image descriptor, no trailer)', () => {
    expect(parseRasterHeader(gifBytes(10, 20, 'GIF87a'))).toBeNull();
    expect(parseRasterHeader(gifBytes(300, 150, 'GIF89a'))).toBeNull();
  });

  it('returns null for a GIF with no trailer', () => {
    const full = validGifBytes(2, 2);
    const noTrailer = full.slice(0, full.length - 1);
    expect(parseRasterHeader(noTrailer)).toBeNull();
  });

  it('returns null for a GIF whose GCT/comment contain 0x2C/0x3B but has no image descriptor', () => {
    expect(parseRasterHeader(gifNoImageDescriptorBytes(10, 20))).toBeNull();
  });

  it('returns null for a GIF with an image descriptor but empty image data', () => {
    expect(parseRasterHeader(gifEmptyImageDataBytes(3, 3))).toBeNull();
  });

  it('rejects GIF frames that exceed or fall outside the logical screen', () => {
    // validGifBytes layout: 6 sig + 7 LSD + 6 GCT, then 0x2c at 19 and the
    // descriptor fields at 20 (left), 22 (top), 24 (width), 26 (height).
    const patch = (edit: (b: Uint8Array) => void): Uint8Array => {
      const b = new Uint8Array(validGifBytes(4, 4));
      edit(b);
      return b;
    };
    // Frame wider than the canvas.
    expect(parseRasterHeader(patch((b) => (b[24] = 5)))).toBeNull();
    // In-bounds frame size, but the offset pushes it past the canvas edge.
    expect(parseRasterHeader(patch((b) => (b[20] = 1)))).toBeNull();
    // Zero-dimension frame is unrenderable.
    expect(parseRasterHeader(patch((b) => (b[24] = 0)))).toBeNull();
    // Offset frame that stays inside the canvas still parses.
    expect(
      parseRasterHeader(
        patch((b) => {
          b[20] = 1;
          b[24] = 3;
        })
      )
    ).toEqual({ format: 'gif', width: 4, height: 4 });
  });

  it('returns null for a JPEG with no SOS/EOI (SOI+SOF only)', () => {
    expect(parseRasterHeader(jpegBytes(10, 20))).toBeNull();
  });

  it('returns null for SOI+SOF+FFDA+FFD9 with no SOS header and no scan', () => {
    expect(parseRasterHeader(jpegNoScanBytes(10, 20))).toBeNull();
  });

  it('returns null for a complete SOS header with zero entropy-coded scan bytes', () => {
    expect(parseRasterHeader(jpegEmptyScanBytes(10, 20))).toBeNull();
  });

  it('returns null for truncated/incomplete magic', () => {
    expect(
      parseRasterHeader(new Uint8Array([0x47, 0x49, 0x46, 0x38]))
    ).toBeNull();
    expect(
      parseRasterHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    ).toBeNull();
    const badTail = pngHeaderBytes(10, 20);
    badTail[7] = 0x00;
    expect(parseRasterHeader(badTail)).toBeNull();
  });

  it('returns null for a PNG IHDR length != 13', () => {
    expect(parseRasterHeader(pngHeaderBytes(10, 20, 14))).toBeNull();
  });

  it('returns null when the declared IHDR/descriptor length exceeds the buffer', () => {
    const truncatedPng = pngHeaderBytes(10, 20).slice(0, 24);
    expect(truncatedPng.length).toBe(24);
    expect(parseRasterHeader(truncatedPng)).toBeNull();
    const truncatedGif = gifBytes(10, 20).slice(0, 10);
    expect(truncatedGif.length).toBe(10);
    expect(parseRasterHeader(truncatedGif)).toBeNull();
  });

  it('returns null for malformed WebP length fields', () => {
    expect(
      parseRasterHeader(
        webpBytes({ variant: 'VP8X', width: 10, height: 20, riffSize: 0 })
      )
    ).toBeNull();
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
    expect(
      parseRasterHeader(
        webpBytes({ variant: 'VP8X', width: 10, height: 20, chunkSize: 9 })
      )
    ).toBeNull();
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
