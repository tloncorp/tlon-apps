/**
 * Shared byte-level image fixtures for the media pipeline unit tests.
 * Test-only helper; not imported by any runtime source module.
 */
import { deflateSync } from 'node:zlib';

/** Decode a base64 string into raw bytes (test-only fixture helper). */
function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

/**
 * A structural PNG header only: 8-byte signature + a complete IHDR chunk whose
 * trailing CRC is left zero and which carries NO IDAT/IEND. The parser bounds
 * the chunk against the buffer but never verifies the CRC or requires image
 * data, so this is enough to exercise parser/classifier BOUNDARY cases — but it
 * is not a renderable image and parseRasterHeader REJECTS it (no IDAT/IEND).
 * Success-path tests that need a genuine image use `validPngBytes` instead.
 */
export function pngHeaderBytes(
  width: number,
  height: number,
  ihdrLen = 13
): Uint8Array {
  // A complete IHDR chunk: 8-byte signature + 4-byte length + 4-byte type +
  // ihdrLen data bytes + 4-byte CRC. The parser bounds the whole chunk against
  // the buffer, so a structurally complete parser-boundary fixture must carry
  // the full declared data AND the trailing CRC (a 24-byte header that stops
  // after width/height is truncated and must be rejected). Note this is a
  // header only, not a renderable image (no IDAT/IEND; see validPngBytes).
  const b = new Uint8Array(8 + 4 + 4 + ihdrLen + 4);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b[8] = (ihdrLen >>> 24) & 0xff;
  b[9] = (ihdrLen >>> 16) & 0xff;
  b[10] = (ihdrLen >>> 8) & 0xff;
  b[11] = ihdrLen & 0xff;
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  b[16] = (width >>> 24) & 0xff;
  b[17] = (width >>> 16) & 0xff;
  b[18] = (width >>> 8) & 0xff;
  b[19] = width & 0xff;
  b[20] = (height >>> 24) & 0xff;
  b[21] = (height >>> 16) & 0xff;
  b[22] = (height >>> 8) & 0xff;
  b[23] = height & 0xff;
  // Plausible remaining IHDR data, structurally complete for parser-boundary
  // tests (CRC intentionally zero; not a renderable image): bit depth 8,
  // color type 6 (truecolor + alpha), compression/filter/interlace 0. The
  // parser bounds the chunk but never verifies the CRC value.
  if (ihdrLen >= 13) {
    b[24] = 8; // bit depth
    b[25] = 6; // color type
    b[26] = 0; // compression method
    b[27] = 0; // filter method
    b[28] = 0; // interlace method
  }
  return b;
}

// PNG CRC32 (reflected, polynomial 0xedb88320), computed over chunk type + data.
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = PNG_CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Serialize a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + 4 + data.length + 4);
  const len = data.length;
  out[0] = (len >>> 24) & 0xff;
  out[1] = (len >>> 16) & 0xff;
  out[2] = (len >>> 8) & 0xff;
  out[3] = len & 0xff;
  const crcInput = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i += 1) {
    const ch = type.charCodeAt(i);
    out[4 + i] = ch;
    crcInput[i] = ch;
  }
  out.set(data, 8);
  crcInput.set(data, 4);
  const crc = pngCrc32(crcInput);
  const crcOff = 8 + data.length;
  out[crcOff] = (crc >>> 24) & 0xff;
  out[crcOff + 1] = (crc >>> 16) & 0xff;
  out[crcOff + 2] = (crc >>> 8) & 0xff;
  out[crcOff + 3] = crc & 0xff;
  return out;
}

/**
 * A structurally-complete PNG with arbitrary IHDR dimensions and a minimal
 * (non-renderable) IDAT + IEND. parseRasterHeader accepts it (IDAT present with
 * length > 0, IEND present), but the IDAT content is a single zero byte — not
 * valid deflate data. Useful for testing classifier bounds checks on dimensions
 * without allocating a real pixel buffer. This is the "accepted residual" case:
 * a container with data + terminal chunks whose compressed data is corrupt.
 */
export function pngCompleteBytes(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', new Uint8Array([0x00])),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * A genuine, complete, renderable PNG: 8-byte signature + a full IHDR chunk with
 * a correct CRC + a deflate-compressed IDAT of `height` raw scanlines + an IEND.
 * Unlike `pngHeaderBytes`, this sniffs as `image/png` AND decodes, so the
 * real-loader success path proves a genuine image round-trips (not merely that
 * header-only non-renderable bytes are accepted). Defaults to a 1×1 RGBA image.
 */
export function validPngBytes(width = 1, height = 1): Uint8Array {
  const signature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha (RGBA)
  // ihdr[10..12] compression/filter/interlace left 0.

  // Raw scanlines: each row is a filter byte (0 = None) followed by `width` RGBA
  // pixels (4 bytes each), all zero (transparent black). deflate for IDAT.
  const raw = new Uint8Array(height * (1 + width * 4));
  const idatData = new Uint8Array(deflateSync(raw));

  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function gifBytes(
  width: number,
  height: number,
  sig: 'GIF87a' | 'GIF89a' = 'GIF87a'
): Uint8Array {
  // 6-byte signature + the full 7-byte logical-screen descriptor (width, height,
  // packed field, background color index, pixel aspect ratio). The parser
  // requires all 13 bytes present, so a 10-byte header carrying only
  // width/height is truncated and must be rejected. This is a header-only
  // fixture (no image descriptor, no trailer) and represents an INCOMPLETE GIF
  // that parseRasterHeader must reject. Use validGifBytes for success paths.
  const b = new Uint8Array(13);
  for (let i = 0; i < sig.length; i += 1) {
    b[i] = sig.charCodeAt(i);
  }
  b[6] = width & 0xff;
  b[7] = (width >>> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (height >>> 8) & 0xff;
  // b[10] packed field, b[11] background color index, b[12] pixel aspect ratio
  // — left zero.
  return b;
}

/**
 * A genuine, structurally-complete minimal GIF: 6-byte signature + 7-byte
 * logical-screen descriptor + a global color table (2 entries) + an image
 * descriptor (0x2C) + image data sub-block + trailer (0x3B). Defaults to 1×1.
 * Unlike `gifBytes`, this has both the image-descriptor separator and the
 * trailer, so parseRasterHeader accepts it and detectMime sniffs image/gif.
 */
export function validGifBytes(
  width = 1,
  height = 1,
  sig: 'GIF87a' | 'GIF89a' = 'GIF87a'
): Uint8Array {
  const parts: number[] = [];
  for (let i = 0; i < sig.length; i += 1) {
    parts.push(sig.charCodeAt(i));
  }
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x80, 0x00, 0x00);
  parts.push(0x00, 0x00, 0x00, 0xff, 0xff, 0xff);
  parts.push(0x2c);
  parts.push(0x00, 0x00, 0x00, 0x00);
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x00);
  parts.push(0x02, 0x02, 0x44, 0x01, 0x00);
  parts.push(0x3b);
  return new Uint8Array(parts);
}

/**
 * A genuine complete GIF89a carrying a Graphic Control Extension (0x21 0xF9)
 * BEFORE the image descriptor. parseRasterHeader must skip the extension via the
 * block grammar and still find the real image descriptor + data + trailer.
 */
export function gifWithExtensionBytes(width = 1, height = 1): Uint8Array {
  const parts: number[] = [];
  for (let i = 0; i < 'GIF89a'.length; i += 1) {
    parts.push('GIF89a'.charCodeAt(i));
  }
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x80, 0x00, 0x00);
  parts.push(0x00, 0x00, 0x00, 0xff, 0xff, 0xff);
  // Graphic Control Extension: introducer + label + block size 4 + 4 bytes + 0x00
  parts.push(0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00);
  parts.push(0x2c);
  parts.push(0x00, 0x00, 0x00, 0x00);
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x00);
  parts.push(0x02, 0x02, 0x44, 0x01, 0x00);
  parts.push(0x3b);
  return new Uint8Array(parts);
}

/**
 * A GIF whose Global Color Table AND a comment-extension payload both contain
 * 0x2C and 0x3B bytes, but which has NO real image descriptor — it goes straight
 * to the trailer. A naive raw-scan for 0x2C would be fooled into accepting this;
 * the block-grammar walk must return null.
 */
export function gifNoImageDescriptorBytes(width = 1, height = 1): Uint8Array {
  const parts: number[] = [];
  for (let i = 0; i < 'GIF89a'.length; i += 1) {
    parts.push('GIF89a'.charCodeAt(i));
  }
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  // packed: GCT flag set, size N=1 -> 2^(1+1) = 4 entries (12 bytes)
  parts.push(0x81, 0x00, 0x00);
  // GCT (4 entries) laced with 0x2C / 0x3B to fool a naive byte-scan
  parts.push(
    0x2c,
    0x3b,
    0x2c,
    0x3b,
    0x2c,
    0x3b,
    0x2c,
    0x3b,
    0x2c,
    0x3b,
    0x2c,
    0x3b
  );
  // comment extension whose payload also contains 0x2C / 0x3B
  parts.push(0x21, 0xfe);
  parts.push(0x04, 0x2c, 0x3b, 0x2c, 0x3b, 0x00);
  // trailer, no image descriptor
  parts.push(0x3b);
  return new Uint8Array(parts);
}

/**
 * A GIF with a real image descriptor but EMPTY image data (LZW-min-code-size
 * byte followed immediately by the 0x00 sub-block terminator). Not renderable;
 * parseRasterHeader must reject it.
 */
export function gifEmptyImageDataBytes(width = 1, height = 1): Uint8Array {
  const parts: number[] = [];
  for (let i = 0; i < 'GIF87a'.length; i += 1) {
    parts.push('GIF87a'.charCodeAt(i));
  }
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x80, 0x00, 0x00);
  parts.push(0x00, 0x00, 0x00, 0xff, 0xff, 0xff);
  parts.push(0x2c);
  parts.push(0x00, 0x00, 0x00, 0x00);
  parts.push(width & 0xff, (width >>> 8) & 0xff);
  parts.push(height & 0xff, (height >>> 8) & 0xff);
  parts.push(0x00);
  // LZW min code size, then an immediate 0x00 terminator (no image data)
  parts.push(0x02, 0x00);
  parts.push(0x3b);
  return new Uint8Array(parts);
}

/**
 * Minimal ISO-BMFF file: a single `ftyp` box (size + 'ftyp' + major brand +
 * minor version + one compatible brand). file-type sniffs AVIF/HEIC/HEIF from
 * the `ftyp` brands, so these bytes carry a real signature rather than relying
 * on a manually-supplied sniff alone.
 */
function ftypBytes(brand: 'avif' | 'heic'): Uint8Array {
  const b = new Uint8Array(24);
  b[3] = 24; // box size (big-endian u32, fits in the low byte)
  b.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
  for (let i = 0; i < 4; i += 1) {
    b[8 + i] = brand.charCodeAt(i); // major brand
  }
  // minor version (bytes 12-15) left zero.
  for (let i = 0; i < 4; i += 1) {
    b[16 + i] = brand.charCodeAt(i); // compatible brand
  }
  return b;
}

export function avifBytes(): Uint8Array {
  return ftypBytes('avif');
}

export function heicBytes(): Uint8Array {
  return ftypBytes('heic');
}

/**
 * Minimal BMP: a 14-byte BITMAPFILEHEADER ('BM' + size + reserved + pixel-data
 * offset) plus the start of a 40-byte BITMAPINFOHEADER — enough for file-type to
 * sniff `image/bmp`.
 */
export function bmpBytes(): Uint8Array {
  const b = new Uint8Array(30);
  b[0] = 0x42; // 'B'
  b[1] = 0x4d; // 'M'
  b[2] = 30; // file size (low byte)
  b[10] = 26; // pixel-data offset
  b[14] = 40; // DIB header size (BITMAPINFOHEADER)
  return b;
}

/**
 * Minimal ICO: an ICONDIR header (reserved=0, type=1 for ICO, count=1). file-type
 * sniffs `image/x-icon` from this prefix.
 */
export function icoBytes(): Uint8Array {
  const b = new Uint8Array(6);
  b[2] = 0x01; // type: ICO
  b[4] = 0x01; // image count: 1
  return b;
}

export function jpegBytes(
  width: number,
  height: number,
  opts?: { components?: number; segLen?: number }
): Uint8Array {
  const components = opts?.components ?? 3;
  const segLen = opts?.segLen ?? 8 + components * 3;
  const b = new Uint8Array(4 + segLen);
  b[0] = 0xff;
  b[1] = 0xd8; // SOI
  b[2] = 0xff;
  b[3] = 0xc0; // SOF0
  b[4] = (segLen >>> 8) & 0xff;
  b[5] = segLen & 0xff;
  b[6] = 0x08; // precision
  b[7] = (height >>> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (width >>> 8) & 0xff;
  b[10] = width & 0xff;
  b[11] = components;
  return b;
}

/**
 * The accepted-residual JPEG: a structurally-complete minimal JPEG (SOI + SOF0
 * with one component + SOS + a single scan byte + EOI) whose scan byte is a
 * placeholder, NOT real entropy-coded data — so it is not a renderable image.
 * parseRasterHeader still accepts it (every required structural block is
 * present; nothing is decoded) and detectMime sniffs image/jpeg. Unlike
 * `jpegBytes` (SOI+SOF only, an INCOMPLETE JPEG that parseRasterHeader must
 * reject). Used for structural acceptance tests; genuine renderable JPEGs use
 * realBaselineJpegBytes / realProgressiveJpegBytes. Defaults to 1×1.
 */
export function validJpegBytes(width = 1, height = 1): Uint8Array {
  const components = 1;
  const sofLen = 8 + components * 3;
  const parts: number[] = [];
  parts.push(0xff, 0xd8);
  parts.push(0xff, 0xc0);
  parts.push((sofLen >>> 8) & 0xff, sofLen & 0xff);
  parts.push(0x08);
  parts.push((height >>> 8) & 0xff, height & 0xff);
  parts.push((width >>> 8) & 0xff, width & 0xff);
  parts.push(components);
  parts.push(0x01, 0x11, 0x00);
  parts.push(0xff, 0xda);
  const sosLen = 6 + components * 2;
  parts.push((sosLen >>> 8) & 0xff, sosLen & 0xff);
  parts.push(components);
  parts.push(0x01, 0x00);
  parts.push(0x00, 0x3f, 0x00);
  parts.push(0x00);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

/**
 * The accepted-residual JPEG (see validJpegBytes) followed by post-EOI padding.
 * parseRasterHeader must accept it (the EOI is a syntactic terminator that need
 * not be the final two bytes); the scan data is still a placeholder, not real
 * entropy-coded data, so this is not a renderable image.
 */
export function jpegPostEoiPaddingBytes(width = 1, height = 1): Uint8Array {
  const base = validJpegBytes(width, height);
  const out = new Uint8Array(base.length + 4);
  out.set(base, 0);
  // four trailing zero bytes after EOI
  return out;
}

/**
 * SOI + valid SOF + a bare 0xFFDA SOS marker + EOI, with NO SOS segment header
 * and NO entropy data. Not renderable; parseRasterHeader must reject it.
 */
export function jpegNoScanBytes(width = 1, height = 1): Uint8Array {
  const components = 1;
  const sofLen = 8 + components * 3;
  const parts: number[] = [];
  parts.push(0xff, 0xd8);
  parts.push(0xff, 0xc0);
  parts.push((sofLen >>> 8) & 0xff, sofLen & 0xff);
  parts.push(0x08);
  parts.push((height >>> 8) & 0xff, height & 0xff);
  parts.push((width >>> 8) & 0xff, width & 0xff);
  parts.push(components);
  parts.push(0x01, 0x11, 0x00);
  parts.push(0xff, 0xda); // bare SOS marker, no header
  parts.push(0xff, 0xd9); // EOI
  return new Uint8Array(parts);
}

/**
 * SOI + valid SOF + a complete, bounds-valid SOS segment header + EOI, but with
 * ZERO entropy-coded scan bytes. Not renderable; parseRasterHeader must reject.
 */
export function jpegEmptyScanBytes(width = 1, height = 1): Uint8Array {
  const components = 1;
  const sofLen = 8 + components * 3;
  const sosLen = 6 + components * 2;
  const parts: number[] = [];
  parts.push(0xff, 0xd8);
  parts.push(0xff, 0xc0);
  parts.push((sofLen >>> 8) & 0xff, sofLen & 0xff);
  parts.push(0x08);
  parts.push((height >>> 8) & 0xff, height & 0xff);
  parts.push((width >>> 8) & 0xff, width & 0xff);
  parts.push(components);
  parts.push(0x01, 0x11, 0x00);
  parts.push(0xff, 0xda);
  parts.push((sosLen >>> 8) & 0xff, sosLen & 0xff);
  parts.push(components);
  parts.push(0x01, 0x00);
  parts.push(0x00, 0x3f, 0x00);
  parts.push(0xff, 0xd9); // EOI immediately after the SOS header
  return new Uint8Array(parts);
}

/**
 * A genuine complete JPEG whose single scan contains byte-stuffing (0xFF00) and
 * a restart marker (0xFFD0). Both are part of the scan, not segment terminators,
 * so parseRasterHeader must still find the trailing EOI and accept.
 */
export function jpegRestartStuffingBytes(width = 1, height = 1): Uint8Array {
  const components = 1;
  const sofLen = 8 + components * 3;
  const sosLen = 6 + components * 2;
  const parts: number[] = [];
  parts.push(0xff, 0xd8);
  parts.push(0xff, 0xc0);
  parts.push((sofLen >>> 8) & 0xff, sofLen & 0xff);
  parts.push(0x08);
  parts.push((height >>> 8) & 0xff, height & 0xff);
  parts.push((width >>> 8) & 0xff, width & 0xff);
  parts.push(components);
  parts.push(0x01, 0x11, 0x00);
  parts.push(0xff, 0xda);
  parts.push((sosLen >>> 8) & 0xff, sosLen & 0xff);
  parts.push(components);
  parts.push(0x01, 0x00);
  parts.push(0x00, 0x3f, 0x00);
  // scan data interleaving a stuffed 0xFF00 and a restart marker 0xFFD0
  parts.push(0xab, 0xff, 0x00, 0xcd, 0xff, 0xd0, 0xef);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

/**
 * A genuine progressive-style multi-scan JPEG: SOI + SOF + (SOS + scan) twice +
 * EOI. parseRasterHeader must tolerate multiple scans and accept.
 */
export function jpegMultiScanBytes(width = 1, height = 1): Uint8Array {
  const components = 1;
  const sofLen = 8 + components * 3;
  const sosLen = 6 + components * 2;
  const parts: number[] = [];
  parts.push(0xff, 0xd8);
  parts.push(0xff, 0xc0);
  parts.push((sofLen >>> 8) & 0xff, sofLen & 0xff);
  parts.push(0x08);
  parts.push((height >>> 8) & 0xff, height & 0xff);
  parts.push((width >>> 8) & 0xff, width & 0xff);
  parts.push(components);
  parts.push(0x01, 0x11, 0x00);
  // first scan
  parts.push(0xff, 0xda);
  parts.push((sosLen >>> 8) & 0xff, sosLen & 0xff);
  parts.push(components);
  parts.push(0x01, 0x00);
  parts.push(0x00, 0x3f, 0x00);
  parts.push(0x12, 0x34);
  // second scan
  parts.push(0xff, 0xda);
  parts.push((sosLen >>> 8) & 0xff, sosLen & 0xff);
  parts.push(components);
  parts.push(0x01, 0x00);
  parts.push(0x01, 0x3f, 0x00);
  parts.push(0x56);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

export function webpBytes(opts: {
  variant: 'VP8 ' | 'VP8L' | 'VP8X';
  width: number;
  height: number;
  riffSize?: number;
  chunkSize?: number;
}): Uint8Array {
  const { variant, width, height } = opts;
  const riffSize = opts.riffSize ?? 22;
  const chunkSize = opts.chunkSize ?? 10;
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  b[4] = riffSize & 0xff;
  b[5] = (riffSize >>> 8) & 0xff;
  b[6] = (riffSize >>> 16) & 0xff;
  b[7] = (riffSize >>> 24) & 0xff;
  b.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  for (let i = 0; i < 4; i += 1) {
    b[12 + i] = variant.charCodeAt(i);
  }
  b[16] = chunkSize & 0xff;
  b[17] = (chunkSize >>> 8) & 0xff;
  b[18] = (chunkSize >>> 16) & 0xff;
  b[19] = (chunkSize >>> 24) & 0xff;
  if (variant === 'VP8X') {
    const w = width - 1;
    const h = height - 1;
    b[24] = w & 0xff;
    b[25] = (w >>> 8) & 0xff;
    b[26] = (w >>> 16) & 0xff;
    b[27] = h & 0xff;
    b[28] = (h >>> 8) & 0xff;
    b[29] = (h >>> 16) & 0xff;
  } else if (variant === 'VP8 ') {
    b[23] = 0x9d;
    b[24] = 0x01;
    b[25] = 0x2a;
    b[26] = width & 0xff;
    b[27] = (width >>> 8) & 0xff;
    b[28] = height & 0xff;
    b[29] = (height >>> 8) & 0xff;
  } else {
    // VP8L
    b[20] = 0x2f;
    const bits = (width - 1) | ((height - 1) << 14);
    b[21] = bits & 0xff;
    b[22] = (bits >>> 8) & 0xff;
    b[23] = (bits >>> 16) & 0xff;
    b[24] = (bits >>> 24) & 0xff;
  }
  return b;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Serialize a RIFF chunk: 4-byte FourCC + 4-byte LE size + payload + pad. */
function riffChunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const size = payload.length;
  const out = new Uint8Array(8 + size + (size & 1));
  for (let i = 0; i < 4; i += 1) {
    out[i] = fourcc.charCodeAt(i);
  }
  out[4] = size & 0xff;
  out[5] = (size >>> 8) & 0xff;
  out[6] = (size >>> 16) & 0xff;
  out[7] = (size >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}

function riffWebpBytes(body: Uint8Array): Uint8Array {
  const riffSize = 4 + body.length; // 'WEBP' fourcc + chunks
  const out = new Uint8Array(8 + riffSize);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >>> 8) & 0xff;
  out[6] = (riffSize >>> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  out.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  out.set(body, 12);
  return out;
}

function vp8xPayload(width: number, height: number, flags = 0): Uint8Array {
  const p = new Uint8Array(10);
  p[0] = flags;
  const w = width - 1;
  const h = height - 1;
  p[4] = w & 0xff;
  p[5] = (w >>> 8) & 0xff;
  p[6] = (w >>> 16) & 0xff;
  p[7] = h & 0xff;
  p[8] = (h >>> 8) & 0xff;
  p[9] = (h >>> 16) & 0xff;
  return p;
}

/** A minimal VP8 (lossy) chunk payload: frame tag + 9D 01 2A sync + dims. */
function vp8Payload(width: number, height: number): Uint8Array {
  const p = new Uint8Array(10);
  p[3] = 0x9d;
  p[4] = 0x01;
  p[5] = 0x2a;
  p[6] = width & 0xff;
  p[7] = (width >>> 8) & 0xff;
  p[8] = height & 0xff;
  p[9] = (height >>> 8) & 0xff;
  return p;
}

/**
 * A VP8X WebP whose animation flag is set but which carries an ANMF frame and
 * NO mandatory ANIM chunk. Not a valid animation; parseRasterHeader must reject
 * it (animation flag set without ANIM ⇒ null).
 */
export function webpVp8xAnimationBytes(width = 10, height = 20): Uint8Array {
  const frameHeader = new Uint8Array(16);
  const w = width - 1;
  const h = height - 1;
  frameHeader[6] = w & 0xff;
  frameHeader[7] = (w >>> 8) & 0xff;
  frameHeader[8] = (w >>> 16) & 0xff;
  frameHeader[9] = h & 0xff;
  frameHeader[10] = (h >>> 8) & 0xff;
  frameHeader[11] = (h >>> 16) & 0xff;
  const anmfPayload = concatBytes([
    frameHeader,
    riffChunk('VP8 ', vp8Payload(width, height)),
  ]);
  const body = concatBytes([
    riffChunk('VP8X', vp8xPayload(width, height, 0x02)),
    riffChunk('ANMF', anmfPayload),
  ]);
  return riffWebpBytes(body);
}

/**
 * A VP8X WebP followed by an EMPTY 'VP8 ' chunk (zero-byte payload). The FourCC
 * is present but there is no bitstream; parseRasterHeader must reject it.
 */
export function webpVp8xEmptyVp8Bytes(width = 10, height = 20): Uint8Array {
  const body = concatBytes([
    riffChunk('VP8X', vp8xPayload(width, height)),
    riffChunk('VP8 ', new Uint8Array(0)),
  ]);
  return riffWebpBytes(body);
}

/**
 * A VP8X WebP followed by an EMPTY 'ANMF' chunk (zero-byte payload). No frame
 * header and no nested bitstream; parseRasterHeader must reject it.
 */
export function webpVp8xEmptyAnmfBytes(width = 10, height = 20): Uint8Array {
  const body = concatBytes([
    riffChunk('VP8X', vp8xPayload(width, height)),
    riffChunk('ANMF', new Uint8Array(0)),
  ]);
  return riffWebpBytes(body);
}

/** The 16-byte ANMF frame header (frame x/y/w/h-1, duration, flags; zeros). */
function anmfFrameHeader(width: number, height: number): Uint8Array {
  const frameHeader = new Uint8Array(16);
  const w = width - 1;
  const h = height - 1;
  frameHeader[6] = w & 0xff;
  frameHeader[7] = (w >>> 8) & 0xff;
  frameHeader[8] = (w >>> 16) & 0xff;
  frameHeader[9] = h & 0xff;
  frameHeader[10] = (h >>> 8) & 0xff;
  frameHeader[11] = (h >>> 16) & 0xff;
  return frameHeader;
}

/** A minimal VP8L (lossless) chunk payload: 0x2f signature byte + dim bits. */
function vp8lPayload(width: number, height: number): Uint8Array {
  const p = new Uint8Array(5);
  p[0] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  p[1] = bits & 0xff;
  p[2] = (bits >>> 8) & 0xff;
  p[3] = (bits >>> 16) & 0xff;
  p[4] = (bits >>> 24) & 0xff;
  return p;
}

/**
 * A VP8X animation (anim flag set + mandatory ANIM) whose FIRST ANMF frame is
 * empty (a 16-byte frame header only, no nested bitstream) FOLLOWED BY a valid
 * ANMF carrying a real VP8L bitstream. libwebp rejects such a file (an empty
 * frame is malformed even alongside valid ones); parseRasterHeader must reject
 * it too — a single bad frame invalidates the whole animation.
 */
export function webpVp8xEmptyAnmfThenValidBytes(
  width = 6,
  height = 5
): Uint8Array {
  const emptyAnmf = anmfFrameHeader(width, height); // 16-byte header only
  const validAnmf = concatBytes([
    anmfFrameHeader(width, height),
    riffChunk('VP8L', vp8lPayload(width, height)),
  ]);
  const body = concatBytes([
    riffChunk('VP8X', vp8xPayload(width, height, 0x02)),
    riffChunk('ANIM', new Uint8Array(6)),
    riffChunk('ANMF', emptyAnmf),
    riffChunk('ANMF', validAnmf),
  ]);
  return riffWebpBytes(body);
}

/**
 * A VP8X animation whose single ANMF frame carries a valid VP8L bitstream
 * FOLLOWED BY trailing garbage bytes that do not tile the frame payload. The
 * nested chunk list does not exhaust the frame exactly, so the frame is
 * malformed and parseRasterHeader must reject the whole animation.
 */
export function webpVp8xAnmfTrailingGarbageBytes(
  width = 6,
  height = 5
): Uint8Array {
  const anmf = concatBytes([
    anmfFrameHeader(width, height),
    riffChunk('VP8L', vp8lPayload(width, height)),
    new Uint8Array([0xde, 0xad, 0xbe]), // trailing garbage, does not tile
  ]);
  const body = concatBytes([
    riffChunk('VP8X', vp8xPayload(width, height, 0x02)),
    riffChunk('ANIM', new Uint8Array(6)),
    riffChunk('ANMF', anmf),
  ]);
  return riffWebpBytes(body);
}

// Real encoder-produced fixtures (ffmpeg / cwebp / webpmux output, validated).
// These ARE genuinely valid, renderable images; the bytes are used verbatim and
// must not be altered. They back the positive "genuinely valid X parses with
// real dims AND sniffs via detectMime" tests, unlike the handcrafted structural
// fixtures above.

/** Genuine baseline (SOF0) JPEG, canvas 2x3. */
export function realBaselineJpegBytes(): Uint8Array {
  return fromB64(
    '/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMQD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABMAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAADAAIDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCLAE1/f//Z'
  );
}

/** Genuine progressive (SOF2) JPEG, canvas 4x2. */
export function realProgressiveJpegBytes(): Uint8Array {
  return fromB64(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAACAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAVAQEBAAAAAAAAAAAAAAAAAAAEBv/aAAwDAQACEAMQAAABjRcF/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD3/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='
  );
}

/** Genuine simple lossy WebP (RIFF/WEBP/VP8 ), canvas 5x4. */
export function realWebpLossyBytes(): Uint8Array {
  return fromB64(
    'UklGRkIAAABXRUJQVlA4IDYAAAAwAgCdASoFAAQAAgA0JZgCdEf/7gACMDuTAAD+9DL/dcTvvd9UqPPNOQ8/zfoHnn7P42ogAAA='
  );
}

/** Genuine simple lossless WebP (RIFF/WEBP/VP8L), canvas 5x4. */
export function realWebpLosslessBytes(): Uint8Array {
  return fromB64('UklGRh4AAABXRUJQVlA4TBEAAAAvBMAAAA8wfxHzH4Y+RPQ/AAA=');
}

/** Genuine extended static WebP (VP8X+ALPH+VP8 ), canvas 7x3. */
export function realWebpVp8xStaticBytes(): Uint8Array {
  return fromB64(
    'UklGRmAAAABXRUJQVlA4WAoAAAAQAAAABgAAAgAAQUxQSAoAAAABB9C/iAhERP8DVlA4IDAAAADQAQCdASoHAAMAAgA0JaACdLoB+AADsAD+8MQL/yC5YXXI1/8gP+QH/ID/+PIAAAA='
  );
}

/** Genuine animated WebP (VP8X+ANIM+ANMF, 2 frames), canvas 6x5. */
export function realWebpAnimatedBytes(): Uint8Array {
  return fromB64(
    'UklGRoQAAABXRUJQVlA4WAoAAAACAAAABQAABAAAQU5JTQYAAAD/////AABBTk1GKAAAAAAAAAAAAAUAAAQAAGQAAAJWUDhMDwAAAC8FAAEABxDlj/4HIqL/AQBBTk1GKAAAAAAAAAAAAAUAAAQAAGQAAABWUDhMDwAAAC8FAAEABxDR/v4HIqL/AQA='
  );
}
