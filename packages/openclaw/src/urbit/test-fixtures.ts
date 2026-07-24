/**
 * Shared byte-level image fixtures for the media pipeline unit tests.
 * Test-only helper; not imported by any runtime source module.
 */
import { deflateSync } from 'node:zlib';

/**
 * A structural PNG header only: 8-byte signature + a complete IHDR chunk whose
 * trailing CRC is left zero and which carries NO IDAT/IEND. The parser bounds
 * the chunk against the buffer but never verifies the CRC or requires image
 * data, so this is enough to exercise parser/classifier BOUNDARY cases — but it
 * is not a renderable image. Success-path tests that need a genuine image use
 * `validPngBytes` instead.
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
  // width/height is truncated and must be rejected.
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
