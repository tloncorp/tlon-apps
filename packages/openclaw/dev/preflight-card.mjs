/**
 * Renders the vision probe card as a PNG, with no browser and no dependencies.
 *
 * Deliberately NOT rendered through `tlon surface preview`: the card is the
 * instrument that decides whether a preview-bearing run may proceed, so it must
 * not fail for any reason the previews themselves could fail for. zlib and a
 * 5x7 digit font are the whole toolchain.
 *
 * The card carries two independent signals, per D111's probe: an unguessable
 * token, and a countable set of squares. The token is DIGITS ONLY — D111's read
 * returned `£5d49e...` for `f5d49e...`, and a glyph the model can confuse with
 * a non-hex character adds noise to the one signal that has to be decisive.
 */
import { deflateSync } from 'node:zlib';

const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = buildCrcTable());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = (crc ^ buf[i]) & 0xff;
    crc = (crc >>> 8) ^ table[c];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {{ token: string, squares: number, scale?: number }} params
 * @returns {{ png: Buffer, width: number, height: number }}
 */
export function renderProbeCard({ token, squares, scale = 22 }) {
  if (!/^[0-9]+$/.test(token)) {
    throw new Error(`probe token must be digits only, got ${token}`);
  }
  const pad = 4 * scale;
  const glyphGap = scale;
  const textW = token.length * (GLYPH_W * scale + glyphGap) - glyphGap;
  const textH = GLYPH_H * scale;
  const squareSize = 4 * scale;
  const squareGap = 2 * scale;
  const squaresW = squares * (squareSize + squareGap) - squareGap;
  const width = pad * 2 + Math.max(textW, squaresW);
  const height = pad * 2 + textH + 3 * scale + squareSize;

  const rgb = Buffer.alloc(width * height * 3, 0xff);
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  };

  const textX = Math.floor((width - textW) / 2);
  for (let c = 0; c < token.length; c += 1) {
    const glyph = FONT[token[c]];
    const gx = textX + c * (GLYPH_W * scale + glyphGap);
    for (let r = 0; r < GLYPH_H; r += 1) {
      for (let k = 0; k < GLYPH_W; k += 1) {
        if (glyph[r][k] !== '1') continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            put(gx + k * scale + dx, pad + r * scale + dy, 17, 17, 17);
          }
        }
      }
    }
  }

  const sqX = Math.floor((width - squaresW) / 2);
  const sqY = pad + textH + 3 * scale;
  for (let s = 0; s < squares; s += 1) {
    const x0 = sqX + s * (squareSize + squareGap);
    for (let dy = 0; dy < squareSize; dy += 1) {
      for (let dx = 0; dx < squareSize; dx += 1) {
        put(x0 + dx, sqY + dy, 0x1f, 0x3f, 0xd8);
      }
    }
  }

  return { png: encodePng(width, height, rgb), width, height };
}
