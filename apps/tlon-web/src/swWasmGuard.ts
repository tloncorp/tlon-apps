const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

// Registering any `cacheWillUpdate` precache plugin turns off Workbox's default
// check that rejects 4xx/5xx responses, so this keeps it. On top of that, a
// `.wasm` response must actually be WebAssembly: docket answers a missing glob
// path with index.html as a 200, and a precached WASM keeps its cache key (and
// so the bad body) across deploys until its content hash changes.
export async function isCacheablePrecacheResponse(
  request: Request,
  response: Response
): Promise<boolean> {
  if (response.status >= 400) {
    return false;
  }
  if (!new URL(request.url).pathname.endsWith('.wasm')) {
    return true;
  }
  const head = new Uint8Array(await response.clone().arrayBuffer());
  return WASM_MAGIC.every((byte, i) => head[i] === byte);
}
