import { deflateSync } from 'node:zlib';

export const concurrentMedia = [
  { id: 'portrait', width: 720, height: 1080 },
  { id: 'landscape', width: 1280, height: 640 },
] as const;

// Real raster pixels: a coordinate grid, color bands and large binary coordinate
// markers. Encoding uses the PNG format and Node zlib, without external assets.
export function makeConcurrentPng(width: number, height: number) {
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const grid = x % 80 < 3 || y % 80 < 3;
      const marker =
        y % 80 > 12 &&
        y % 80 < 28 &&
        x % 80 > 10 &&
        x % 80 < 65 &&
        ((Math.floor(y / 80) + 1) >> Math.floor(((x % 80) - 10) / 8)) & 1;
      pixels[offset] = grid || marker ? 16 : 55 + Math.floor((x / width) * 170);
      pixels[offset + 1] =
        grid || marker ? 28 : 65 + Math.floor((y / height) * 150);
      pixels[offset + 2] =
        grid || marker ? 44 : 180 - Math.floor((x / width) * 90);
    }
  function chunk(type: string, bytes: Buffer) {
    const data = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length);
    const footer = Buffer.alloc(4);
    footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, data, footer]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
