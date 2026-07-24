/**
 * Plugin-local PNG/JPEG/GIF/WebP header parsing, derived from the Tlon skill
 * parser (`packages/tlon-skill/scripts/image-attach.ts`) but with stricter
 * structural validation and format detection: besides the canonical magics, the
 * container length fields are validated, so a magic-valid but zero/absurd-length
 * file (e.g. a WebP with RIFF size 0 and a VP8X chunk size of 0) is rejected
 * instead of parsing "successfully" at dimensions no decoder could honor.
 *
 * Kept a private copy — not a shared `@tloncorp/api` export — because the plugin
 * and skill publish independently, and their shared dep resolves from the npm
 * registry in the plugin's standalone installs; exporting there would gate this
 * fix on a coordinated api release.
 *
 * Callers, not the parser, judge dimension validity (positive, bounded).
 */

function u16be(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function u32be(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function u16le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function u24le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

function u32le(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function ascii(b: Uint8Array, o: number, len: number): string {
  return String.fromCharCode(...b.subarray(o, o + len));
}

// A VP8 /VP8L chunk qualifies as an image bitstream only when its payload is
// large enough to hold the variant's fixed header AND carries that header's
// signature (the VP8 0x9d 0x01 0x2a start code at payload offset 3, or the VP8L
// 0x2f signature byte at offset 0). FourCC presence alone is not enough.
function webpChunkIsBitstream(
  b: Uint8Array,
  fourcc: string,
  payload: number,
  size: number
): boolean {
  if (fourcc === 'VP8 ') {
    return (
      size >= 10 &&
      b[payload + 3] === 0x9d &&
      b[payload + 4] === 0x01 &&
      b[payload + 5] === 0x2a
    );
  }
  if (fourcc === 'VP8L') {
    return size >= 5 && b[payload] === 0x2f;
  }
  return false;
}

// An ANMF frame payload begins with a 16-byte frame header; the bytes after it
// are a bounded RIFF chunk list. True when that nested list holds at least one
// VP8 /VP8L bitstream subchunk passing webpChunkIsBitstream. `start` is the
// offset of the ANMF payload and `size` its declared length; the walk never
// reads past [start+16, start+size) or the buffer.
function webpAnmfHasBitstream(
  b: Uint8Array,
  start: number,
  size: number
): boolean {
  if (size < 16) return false;
  const listEnd = start + size;
  let off = start + 16;
  let found = false;
  while (off < listEnd) {
    if (off + 8 > listEnd || off + 8 > b.length) return false;
    const fourcc = ascii(b, off, 4);
    const subSize = u32le(b, off + 4);
    const subPayload = off + 8;
    const subEnd = subPayload + subSize + (subSize & 1);
    if (subEnd > listEnd || subEnd > b.length) return false;
    if (webpChunkIsBitstream(b, fourcc, subPayload, subSize)) found = true;
    off = subEnd;
  }
  // Require exact tiling AND a real bitstream: an empty, header-only, or
  // trailing-garbage ANMF is a malformed frame.
  return found && off === listEnd;
}

export type RasterInfo = {
  format: 'png' | 'jpeg' | 'gif' | 'webp';
  width: number;
  height: number;
};

/**
 * Parse raster image dimensions and format from raw bytes.
 *
 * Enforces complete canonical magics AND structural length fields. Returns
 * `null` (never a partial result) when the magic is incomplete, a length field
 * is implausible, or parsing otherwise fails.
 */
export function parseRasterHeader(bytes: Uint8Array): RasterInfo | null {
  // PNG: full 8-byte signature; IHDR is always the first chunk and its length
  // field must be exactly 13. After reading IHDR, walk the remaining chunk
  // sequence requiring at least one IDAT (length > 0) followed by an IEND
  // (length 0). CRC values are NOT verified and IDAT is NOT inflated.
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    if (
      bytes[4] !== 0x0d ||
      bytes[5] !== 0x0a ||
      bytes[6] !== 0x1a ||
      bytes[7] !== 0x0a
    ) {
      return null;
    }
    if (bytes.length < 16) {
      return null;
    }
    const ihdrLen = u32be(bytes, 8);
    if (ihdrLen !== 13 || ascii(bytes, 12, 4) !== 'IHDR') {
      return null;
    }
    if (bytes.length < 8 + 4 + 4 + ihdrLen + 4) {
      return null;
    }
    const width = u32be(bytes, 16);
    const height = u32be(bytes, 20);
    let offset = 8 + 4 + 4 + ihdrLen + 4;
    let sawIdat = false;
    while (offset + 8 <= bytes.length) {
      const chunkLen = u32be(bytes, offset);
      const chunkType = ascii(bytes, offset + 4, 4);
      const chunkEnd = offset + 4 + 4 + chunkLen + 4;
      if (chunkEnd > bytes.length) {
        return null;
      }
      if (chunkType === 'IDAT' && chunkLen > 0) {
        sawIdat = true;
      }
      if (chunkType === 'IEND') {
        if (chunkLen !== 0) {
          return null;
        }
        if (!sawIdat) {
          return null;
        }
        return { format: 'png', width, height };
      }
      offset = chunkEnd;
    }
    return null;
  }

  // GIF87a / GIF89a: six-byte signature + seven-byte logical-screen descriptor,
  // then a bounded walk of the block grammar rather than a raw scan for 0x2C
  // (which a 0x2C inside the global color table or an extension payload would
  // fool). Skip the Global Color Table when its flag is set (3 * 2^(N+1) bytes
  // per the packed field), then loop over 0x21 extensions (label + data
  // sub-blocks, each a length byte + that many bytes, terminated by a 0x00
  // sub-block), 0x2C image descriptors (skip any Local Color Table, then the
  // LZW-min-code-size byte + image-data sub-blocks), and the 0x3B trailer.
  // Require at least one real image descriptor carrying NON-EMPTY image data
  // before the trailer; every step is bounds-checked against the buffer.
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'GIF8') {
    if (bytes.length < 6) {
      return null;
    }
    const sig = ascii(bytes, 0, 6);
    if (sig !== 'GIF87a' && sig !== 'GIF89a') {
      return null;
    }
    if (bytes.length < 13) {
      return null;
    }
    const n = bytes.length;
    let i = 13;
    const packed = bytes[10];
    if (packed & 0x80) {
      i += 3 * (1 << ((packed & 0x07) + 1));
      if (i > n) {
        return null;
      }
    }
    let sawImage = false;
    for (;;) {
      if (i >= n) {
        return null;
      }
      const block = bytes[i];
      if (block === 0x3b) {
        if (!sawImage) {
          return null;
        }
        return {
          format: 'gif',
          width: u16le(bytes, 6),
          height: u16le(bytes, 8),
        };
      }
      if (block === 0x21) {
        if (i + 2 > n) {
          return null;
        }
        i += 2;
        for (;;) {
          if (i >= n) {
            return null;
          }
          const len = bytes[i];
          i += 1;
          if (len === 0) {
            break;
          }
          i += len;
          if (i > n) {
            return null;
          }
        }
        continue;
      }
      if (block === 0x2c) {
        i += 1;
        if (i + 9 > n) {
          return null;
        }
        // GIF89a §20 requires every frame to fit inside the logical screen.
        // Decoders diverge on violations (clip, reject, or allocate from the
        // descriptor), so an oversized descriptor behind a small canvas would
        // bypass the canvas-based pixel bounds. Reject it, and reject empty
        // frames, which nothing can render.
        const frameLeft = u16le(bytes, i);
        const frameTop = u16le(bytes, i + 2);
        const frameWidth = u16le(bytes, i + 4);
        const frameHeight = u16le(bytes, i + 6);
        if (
          frameWidth === 0 ||
          frameHeight === 0 ||
          frameLeft + frameWidth > u16le(bytes, 6) ||
          frameTop + frameHeight > u16le(bytes, 8)
        ) {
          return null;
        }
        const imgPacked = bytes[i + 8];
        i += 9;
        if (imgPacked & 0x80) {
          i += 3 * (1 << ((imgPacked & 0x07) + 1));
          if (i > n) {
            return null;
          }
        }
        if (i >= n) {
          return null;
        }
        i += 1;
        let dataBytes = 0;
        for (;;) {
          if (i >= n) {
            return null;
          }
          const len = bytes[i];
          i += 1;
          if (len === 0) {
            break;
          }
          dataBytes += len;
          i += len;
          if (i > n) {
            return null;
          }
        }
        if (dataBytes > 0) {
          sawImage = true;
        }
        continue;
      }
      return null;
    }
  }

  // JPEG: SOI + a bounded marker-grammar walk. Record dimensions from a
  // start-of-frame segment, then require a Start-Of-Scan segment whose header
  // (length + component selectors) bounds-checks, followed by at least one byte
  // of entropy-coded scan data, before a syntactic End-Of-Image marker. Within
  // the scan, byte-stuffing (0xFF00) and restart markers (0xFFD0–0xFFD7) are
  // part of the scan, not segment terminators, and multiple scans are tolerated.
  // The EOI need only appear AFTER the scan data — trailing padding after EOI is
  // permitted, so complete JPEGs with post-EOI bytes still parse. Nothing is
  // huffman-decoded or dequantized; this is structural presence + bounds only.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const n = bytes.length;
    let dims: { height: number; width: number } | null = null;
    let sawScan = false;
    let i = 2;
    for (;;) {
      if (i + 1 >= n) {
        return null;
      }
      if (bytes[i] !== 0xff) {
        return null;
      }
      while (i < n && bytes[i] === 0xff) {
        i += 1;
      }
      if (i >= n) {
        return null;
      }
      const marker = bytes[i];
      i += 1;
      if (
        marker === 0x01 ||
        marker === 0xd8 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        continue;
      }
      if (marker === 0xd9) {
        if (!dims || !sawScan) {
          return null;
        }
        if (dims.height === 0) {
          return null;
        }
        return { format: 'jpeg', height: dims.height, width: dims.width };
      }
      if (marker === 0xda) {
        if (!dims) {
          return null;
        }
        if (i + 2 > n) {
          return null;
        }
        const sosLen = u16be(bytes, i);
        if (sosLen < 8) {
          return null;
        }
        if (i + sosLen > n) {
          return null;
        }
        const ns = bytes[i + 2];
        if (ns < 1 || sosLen !== 6 + ns * 2) {
          return null;
        }
        let k = i + sosLen;
        let scanData = 0;
        for (;;) {
          if (k >= n) {
            return null;
          }
          if (bytes[k] !== 0xff) {
            k += 1;
            scanData += 1;
            continue;
          }
          if (k + 1 >= n) {
            return null;
          }
          const next = bytes[k + 1];
          if (next === 0x00) {
            k += 2;
            scanData += 1;
            continue;
          }
          if (next >= 0xd0 && next <= 0xd7) {
            k += 2;
            continue;
          }
          if (next === 0xff) {
            k += 1;
            continue;
          }
          break;
        }
        if (scanData < 1) {
          return null;
        }
        sawScan = true;
        i = k;
        continue;
      }
      // Reject DNL JPEGs outright. T.81 allows DNL to (re)define the line
      // count, but the deployed decoder ecosystem does not honor it —
      // libjpeg-turbo (Android, Chromium) ignores DNL and rejects a zero-height
      // SOF as "DNL not supported" — so any DNL-dependent height is either
      // undecodable by clients or diverges from what they decode. Accepting
      // one would recreate the false-success path this parser exists to close.
      if (marker === 0xdc) {
        return null;
      }
      if (i + 2 > n) {
        return null;
      }
      const segLen = u16be(bytes, i);
      if (segLen < 2) {
        return null;
      }
      if (i + segLen > n) {
        return null;
      }
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        if (i + 8 > n) {
          return null;
        }
        const components = bytes[i + 7];
        if (components < 1) {
          return null;
        }
        if (segLen !== 8 + components * 3) {
          return null;
        }
        dims = {
          height: u16be(bytes, i + 3),
          width: u16be(bytes, i + 5),
        };
      }
      i += segLen;
    }
  }

  // WebP: RIFF container; the RIFF size field and the variant chunk size are
  // bounded against both the RIFF boundary and the buffer before dimension
  // bytes are read.
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    const riffSize = u32le(bytes, 4);
    if (riffSize === 0 || riffSize + 8 > bytes.length) {
      return null;
    }
    const riffEnd = 8 + riffSize;
    if (bytes.length < 20) {
      return null;
    }
    const chunk = ascii(bytes, 12, 4);
    const chunkSize = u32le(bytes, 16);
    const paddedEnd = 20 + chunkSize + (chunkSize & 1);
    if (paddedEnd > riffEnd || paddedEnd > bytes.length) {
      return null;
    }
    if (chunk === 'VP8 ') {
      if (chunkSize < 10) {
        return null;
      }
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
        return null;
      }
      return {
        format: 'webp',
        width: u16le(bytes, 26) & 0x3fff,
        height: u16le(bytes, 28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      if (chunkSize < 5) {
        return null;
      }
      if (bytes[20] !== 0x2f) {
        return null;
      }
      const bits = u32le(bytes, 21);
      return {
        format: 'webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X') {
      if (chunkSize !== 10) {
        return null;
      }
      const animFlag = (bytes[20] & 0x02) !== 0;
      const width = u24le(bytes, 24) + 1;
      const height = u24le(bytes, 27) + 1;
      // A VP8X extended header alone carries no pixels. Walk the bounded RIFF
      // chunk list within the RIFF-size bound and require an actual image
      // bitstream, not merely a chunk FourCC: a static VP8 /VP8L that passes the
      // minimum-header checks, or — when the animation flag is set — the
      // mandatory ANIM chunk plus at least one ANMF frame whose payload carries
      // a nested VP8 /VP8L bitstream. VP8X-only files, empty/header-only image
      // chunks, and animation flagged without ANIM/a valid frame are rejected.
      let off = paddedEnd;
      let hasImage = false;
      let hasAnim = false;
      let hasFrame = false;
      while (off + 8 <= riffEnd && off + 8 <= bytes.length) {
        const fourcc = ascii(bytes, off, 4);
        const cSize = u32le(bytes, off + 4);
        const payload = off + 8;
        const cEnd = payload + cSize + (cSize & 1);
        if (cEnd > riffEnd || cEnd > bytes.length) {
          return null;
        }
        if (fourcc === 'VP8 ' || fourcc === 'VP8L') {
          if (webpChunkIsBitstream(bytes, fourcc, payload, cSize)) {
            hasImage = true;
          }
        } else if (fourcc === 'ANIM') {
          if (cSize >= 6) {
            hasAnim = true;
          }
        } else if (fourcc === 'ANMF') {
          // Every ANMF frame must carry a real bitstream; an empty or malformed
          // frame — even alongside valid ones — makes the animation invalid
          // (libwebp rejects such files).
          if (!webpAnmfHasBitstream(bytes, payload, cSize)) {
            return null;
          }
          hasFrame = true;
        }
        off = cEnd;
      }
      if (animFlag) {
        if (!hasAnim || !hasFrame) {
          return null;
        }
      } else if (!hasImage) {
        return null;
      }
      return { format: 'webp', width, height };
    }
    return null;
  }

  return null;
}
