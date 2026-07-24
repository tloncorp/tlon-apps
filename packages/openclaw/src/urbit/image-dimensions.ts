/**
 * Plugin-local raster image header parsing (PNG/JPEG/GIF/WebP).
 *
 * Derived from `imageDimensions` in `packages/tlon-skill/scripts/image-attach.ts`
 * (byte-reader helpers + PNG/JPEG/GIF/WebP header parsing), but returns the
 * detected format alongside the dimensions and tightens the checks: besides the
 * canonical magics, the container's structural length fields are validated so a
 * magic-valid but zero/absurd-length file (e.g. a WebP with a `RIFF` size of `0`
 * and a `VP8X` chunk size of `0`) is rejected instead of parsing "successfully"
 * with dimensions that no decoder could honor.
 *
 * This is intentionally a private copy rather than a shared export from
 * `@tloncorp/api`: the plugin and the skill are independently published npm
 * artifacts, and `@tloncorp/api` (their only shared dependency) resolves from
 * the npm registry in the plugin's standalone installs
 * (`packages/openclaw/dev/entrypoint.test.sh:40`), so exporting it there would
 * gate this fix on a coordinated api release. The plugin variant is stricter by
 * design.
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
  // field must be exactly 13.
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    if (
      bytes[4] !== 0x0d ||
      bytes[5] !== 0x0a ||
      bytes[6] !== 0x1a ||
      bytes[7] !== 0x0a
    ) {
      return null;
    }
    // Need the chunk header (4-byte length + 4-byte type) before reading the
    // declared IHDR length and type.
    if (bytes.length < 16) {
      return null;
    }
    const ihdrLen = u32be(bytes, 8);
    if (ihdrLen !== 13 || ascii(bytes, 12, 4) !== 'IHDR') {
      return null;
    }
    // The full declared IHDR chunk — length field (4) + type (4) + the declared
    // data bytes (ihdrLen) + CRC (4) — must actually be present in the buffer,
    // not merely claimed by the length field. A truncated header that declares
    // 13 data bytes but stops short of them (or of the CRC) is rejected.
    if (bytes.length < 8 + 4 + 4 + ihdrLen + 4) {
      return null;
    }
    return { format: 'png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
  }

  // GIF87a / GIF89a (not just "GIF8"): logical-screen descriptor right after
  // the six-byte signature.
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'GIF8') {
    if (bytes.length < 6) {
      return null;
    }
    const sig = ascii(bytes, 0, 6);
    if (sig !== 'GIF87a' && sig !== 'GIF89a') {
      return null;
    }
    // The full 7-byte logical-screen descriptor (width, height, packed field,
    // background color index, pixel aspect ratio) must be present in the buffer,
    // not just the width/height prefix.
    if (bytes.length < 13) {
      return null;
    }
    return { format: 'gif', width: u16le(bytes, 6), height: u16le(bytes, 8) };
  }

  // JPEG: SOI + segment walk to a start-of-frame marker. Each scanned segment's
  // length field must be >= 2 and lie within the buffer; the SOF must carry at
  // least one component and its length must be exactly 8 + components*3.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i] !== 0xff) {
        return null;
      }
      const marker = bytes[i + 1];
      if (marker === 0xff) {
        i += 1; // fill byte
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2; // standalone marker, no length
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) {
        return null; // EOI/SOS before any SOF
      }
      const segLen = u16be(bytes, i + 2);
      if (segLen < 2) {
        return null;
      }
      if (i + 2 + segLen > bytes.length) {
        return null; // segment crosses the buffer boundary
      }
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        if (i + 9 >= bytes.length) {
          return null;
        }
        const components = bytes[i + 9];
        if (components < 1) {
          return null;
        }
        if (segLen !== 8 + components * 3) {
          return null;
        }
        return {
          format: 'jpeg',
          height: u16be(bytes, i + 5),
          width: u16be(bytes, i + 7),
        };
      }
      i += 2 + segLen;
    }
    return null;
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
      return null; // reject 0 and oversized sentinels (e.g. 0xffffffff)
    }
    const riffEnd = 8 + riffSize;
    if (bytes.length < 20) {
      return null; // no complete chunk header
    }
    const chunk = ascii(bytes, 12, 4);
    const chunkSize = u32le(bytes, 16);
    const paddedEnd = 20 + chunkSize + (chunkSize & 1);
    if (paddedEnd > riffEnd || paddedEnd > bytes.length) {
      return null; // chunk crosses the RIFF boundary or the buffer
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
      return {
        format: 'webp',
        width: u24le(bytes, 24) + 1,
        height: u24le(bytes, 27) + 1,
      };
    }
    return null;
  }

  return null;
}
