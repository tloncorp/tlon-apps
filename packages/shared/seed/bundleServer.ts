import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/**
 * The local stand-in for remote storage.
 *
 * In production a surface bundle rides the same S3-compatible upload path
 * as images, and `assetRef` points at that bucket. Provisioning the bot's
 * moon with write access to a user's bucket is a separate, human,
 * out-of-repo item — so the seed serves bundles from a plain localhost
 * file server instead and points `assetRef` at it.
 *
 * Nothing in the client special-cases this. `useSurfaceBundle` fetches
 * `assetRef` on the host's own network stack and `getOrFetchBundle`
 * hash-verifies the bytes before the sandbox sees them, exactly as it
 * would against a real bucket. Storage is transport, not trust: the sha256
 * in the spec is the authority either way.
 *
 * The server also takes uploads (`PUT /<sha256>.js`), which is what lets
 * `tlon surface publish` run against the fakeships with no S3 anywhere.
 * Two properties of that path are deliberate:
 *
 *  - **It enforces the key SHAPE, not a key↔bytes binding.** A key must be
 *    `<64 lowercase hex>.js` — the publisher's own `bundleFileName(sha256)`
 *    — so a key minted from a clock or a counter is rejected at the door
 *    rather than silently accepted. But the store never checks that the
 *    body hashes to the name. Real S3 does not either, and building that
 *    check in here would make storage a party to trust, which is exactly
 *    what §3 says it is not. It would also make the tampered-bundle case
 *    inexpressible, and that case is the one thing the client's
 *    verification exists for.
 *  - **A second PUT to the same key overwrites it.** That is the modelled
 *    threat verbatim: whoever holds the bucket can change the bytes at a
 *    key, and cannot thereby change what clients will run.
 */

export const DEFAULT_BUNDLE_PORT = 4321;
/** A second origin, used only as the hostile-navigation probes' target. */
export const DEFAULT_ATTACKER_PORT = 4322;

/**
 * The only key shape the store accepts on upload: a bundle's own sha256,
 * which is what `bundleFileName` in the publish gate produces. Anything
 * else — a timestamped key, a counter, a human name — is refused, so a
 * regression that stopped deriving the key from the content fails loudly
 * at publish time instead of quietly producing a non-addressable object.
 */
export const UPLOAD_KEY_PATTERN = /^[0-9a-f]{64}\.js$/;

/**
 * Upload body cap. Four times the 256 KB bundle cap: generous enough that
 * the cap is never the thing under test, small enough to bound a runaway
 * writer on a loopback dev server.
 */
const MAX_UPLOAD_BYTES = 1024 * 1024;

export interface ServedBundle {
  /** file name under the served directory */
  name: string;
  content: string;
  /**
   * Content-Length to advertise, when it should differ from the real body
   * length. Used by the oversized fixture to exercise the pre-buffer cap
   * check in `fetchBundleText`.
   */
  declaredLength?: number;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

export function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** Reads a request body, or `null` once it exceeds `cap`. */
function readBody(
  req: http.IncomingMessage,
  cap: number
): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > cap) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Writes the bundle set to `outDir` and serves it, and accepts uploads at
 * content-addressed keys. Files are written to disk as well as held in
 * memory so a human can inspect exactly what bytes the hash pins.
 */
export async function startBundleServer(options: {
  bundles: ServedBundle[];
  outDir: string;
  port?: number;
}): Promise<{ origin: string; close: () => Promise<void> }> {
  const port = options.port ?? DEFAULT_BUNDLE_PORT;
  // Reassigned from the bound address once listening, so `port: 0` (an
  // ephemeral port — what tests want, so they never race the seed's :4321)
  // still mints correct URLs. Only read inside request handlers, which
  // cannot run before `listen` resolves.
  let origin = `http://127.0.0.1:${port}`;
  fs.mkdirSync(options.outDir, { recursive: true });

  const byName = new Map<string, ServedBundle>();
  for (const bundle of options.bundles) {
    byName.set(bundle.name, bundle);
    fs.writeFileSync(path.join(options.outDir, bundle.name), bundle.content);
  }

  /** Uploaded objects, by key. A repeat PUT to a key replaces it. */
  const uploaded = new Map<string, Buffer>();

  function plain(res: http.ServerResponse, status: number, text: string) {
    res.writeHead(status, {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end(text);
  }

  async function handleUpload(
    key: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    if (!UPLOAD_KEY_PATTERN.test(key)) {
      // The publisher derives this key from the bundle's own sha256. A key
      // of any other shape means it stopped doing that, and a dev store
      // that accepted it would hide the regression until someone noticed
      // two URLs for identical bytes.
      plain(
        res,
        400,
        `key-not-content-addressed: "${key}" is not <sha256>.js. ` +
          `The dev store only accepts keys derived from the bundle's own hash.`
      );
      return;
    }
    const body = await readBody(req, MAX_UPLOAD_BYTES);
    if (body === null) {
      plain(res, 413, `upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
      return;
    }
    uploaded.set(key, body);
    fs.writeFileSync(path.join(options.outDir, key), body);
    res.writeHead(201, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    // `sha256` is the hash of what was actually STORED, which on a tamper
    // is not the key. Reporting both is what makes the store's honesty —
    // it never checks the two against each other — visible to its caller.
    res.end(
      JSON.stringify({
        url: `${origin}/${key}`,
        key,
        size: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
      })
    );
  }

  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').replace(/^\/+/, '')).split(
      '?'
    )[0];

    if (req.method === 'PUT' || req.method === 'POST') {
      handleUpload(name, req, res).catch((error) => {
        plain(res, 500, `upload failed: ${String(error)}`);
      });
      return;
    }

    const bundle = byName.get(name);
    const upload = bundle === undefined ? uploaded.get(name) : undefined;
    if (bundle === undefined && upload === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('no such bundle');
      return;
    }
    const body = upload ?? Buffer.from(bundle!.content, 'utf8');
    res.writeHead(200, {
      'content-type': 'application/javascript; charset=utf-8',
      'content-length': String(bundle?.declaredLength ?? body.byteLength),
      // the host page fetches this cross-origin (localhost:3000 →
      // localhost:4321), so the stand-in has to answer CORS the way a
      // storage bucket would
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    res.end(body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const bound = server.address();
  if (bound !== null && typeof bound !== 'string') {
    origin = `http://127.0.0.1:${bound.port}`;
  }

  return {
    origin,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * The hostile-navigation probes need somewhere to navigate TO. A second
 * origin that answers everything makes a successful navigation
 * unmistakable: the surface is replaced by a page that says so.
 */
export async function startAttackerServer(
  port = DEFAULT_ATTACKER_PORT
): Promise<{ origin: string; hits: string[]; close: () => Promise<void> }> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '/');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end(
      '<!doctype html><meta charset="utf-8">' +
        '<body style="font:16px system-ui;background:#7f1d1d;color:#fff;padding:24px">' +
        '<h1>NAVIGATION SUCCEEDED</h1>' +
        '<p>The sandbox frame reached an off-origin URL. This vector is open.</p>'
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return {
    origin: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
