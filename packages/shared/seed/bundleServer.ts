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
 */

export const DEFAULT_BUNDLE_PORT = 4321;
/** A second origin, used only as the hostile-navigation probes' target. */
export const DEFAULT_ATTACKER_PORT = 4322;

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

/**
 * Writes the bundle set to `outDir` and serves it. Files are written to
 * disk as well as held in memory so a human can inspect exactly what bytes
 * the hash pins.
 */
export async function startBundleServer(options: {
  bundles: ServedBundle[];
  outDir: string;
  port?: number;
}): Promise<{ origin: string; close: () => Promise<void> }> {
  const port = options.port ?? DEFAULT_BUNDLE_PORT;
  fs.mkdirSync(options.outDir, { recursive: true });

  const byName = new Map<string, ServedBundle>();
  for (const bundle of options.bundles) {
    byName.set(bundle.name, bundle);
    fs.writeFileSync(path.join(options.outDir, bundle.name), bundle.content);
  }

  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').replace(/^\/+/, '')).split(
      '?'
    )[0];
    const bundle = byName.get(name);
    if (bundle === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('no such bundle');
      return;
    }
    const body = Buffer.from(bundle.content, 'utf8');
    res.writeHead(200, {
      'content-type': 'application/javascript; charset=utf-8',
      'content-length': String(bundle.declaredLength ?? body.byteLength),
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

  return {
    origin: `http://127.0.0.1:${port}`,
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
