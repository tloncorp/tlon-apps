import { describe, expect, it } from 'vitest';

import { isCacheablePrecacheResponse } from './swWasmGuard';

const WASM_URL =
  'https://ship.example/apps/groups/assets/sqlite3-bhtvbrz5.wasm';
const WASM_HEADER = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
]);

const check = (url: string, body: BodyInit | null, status = 200) =>
  isCacheablePrecacheResponse(new Request(url), new Response(body, { status }));

describe('isCacheablePrecacheResponse', () => {
  it('caches a WASM response that starts with the WebAssembly magic bytes', async () => {
    expect(await check(WASM_URL, WASM_HEADER)).toBe(true);
  });

  it('refuses docket’s index.html fallback served for a WASM path', async () => {
    expect(await check(WASM_URL, '<!doctype html><html></html>')).toBe(false);
  });

  it('refuses an empty WASM body', async () => {
    expect(await check(WASM_URL, null)).toBe(false);
  });

  it('leaves the body of non-WASM assets unchecked', async () => {
    expect(
      await check(
        'https://ship.example/apps/groups/index.html',
        '<!doctype html>'
      )
    ).toBe(true);
  });

  it('keeps refusing error responses, as Workbox does by default', async () => {
    expect(await check(WASM_URL, WASM_HEADER, 502)).toBe(false);
    expect(
      await check(
        'https://ship.example/apps/groups/assets/index-abc.js',
        '',
        404
      )
    ).toBe(false);
  });

  it('does not consume the response it is given', async () => {
    const response = new Response(WASM_HEADER);
    await isCacheablePrecacheResponse(new Request(WASM_URL), response);
    expect(response.bodyUsed).toBe(false);
  });
});
