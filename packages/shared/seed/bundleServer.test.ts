import type { SurfaceBundleRef } from '@tloncorp/api';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { getOrFetchBundle } from '../src/store/surface/bundleCache';
import { setupDatabaseTestSuite } from '../src/test/helpers';
import {
  UPLOAD_KEY_PATTERN,
  sha256Hex,
  startBundleServer,
} from './bundleServer';

/**
 * The dev storage stand-in, and the one thing it must not be able to do:
 * make a client render bytes the spec did not pin.
 *
 * Every assertion here runs against a real HTTP server over a real socket,
 * and the verification is `getOrFetchBundle` itself — the module the app
 * uses, imported unmodified. Nothing in this file may be made to pass by
 * relaxing the client; if it ever needs a flag or a trusted-origin branch
 * in `bundleCache.ts`, the design is wrong.
 */

setupDatabaseTestSuite();

const running: { close: () => Promise<void> }[] = [];

afterEach(async () => {
  while (running.length > 0) await running.pop()!.close();
});

async function startStore() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-devstore-'));
  // port 0: an ephemeral port, so this never races the seed's :4321
  const server = await startBundleServer({ bundles: [], outDir, port: 0 });
  running.push(server);
  return { ...server, outDir };
}

/** What the publish gate uploads under: `bundleFileName(sha256)`. */
function keyFor(content: string): string {
  return `${sha256Hex(content)}.js`;
}

async function put(origin: string, key: string, content: string) {
  return fetch(`${origin}/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/javascript' },
    body: content,
  });
}

/**
 * The fetcher the client injects. `packages/app`'s `fetchBundleText` adds a
 * pre-buffer Content-Length check on top of this; that check is covered by
 * `useSurfaceBundle.test.ts` and the oversized seed fixture, and is not
 * what is under test here. What is under test is that the bytes reach
 * `getOrFetchBundle` and it refuses them.
 */
async function fetchBundle(ref: SurfaceBundleRef): Promise<string> {
  const response = await fetch(ref.assetRef);
  if (!response.ok) throw new Error(`bundle fetch failed: ${response.status}`);
  return response.text();
}

/* ------------------------------------------------------------------ */
/* content-addressed minting                                           */
/* ------------------------------------------------------------------ */

test('the minted assetRef is the bundle hash, and only the bundle hash', async () => {
  const { origin, outDir } = await startStore();
  const content = 'export function render(){ return "poll" }';

  const first = await put(origin, keyFor(content), content);
  expect(first.status).toBe(201);
  const minted = (await first.json()) as { url: string; sha256: string };

  expect(minted.url).toBe(`${origin}/${sha256Hex(content)}.js`);
  // the store hashed what it stored, and it matches the key it was given
  expect(minted.sha256).toBe(sha256Hex(content));
  expect(fs.existsSync(path.join(outDir, keyFor(content)))).toBe(true);

  // Re-uploading identical bytes must land on the identical URL. This is
  // the assertion a timestamped or counter-based key fails: production's
  // `uploadFile` builds `<ship>/<@da-now>-<name>` and would mint two URLs
  // here. The dev store deliberately does not.
  const second = await put(origin, keyFor(content), content);
  expect(((await second.json()) as { url: string }).url).toBe(minted.url);

  // and different bytes get a different key, so the address is the content
  const other = 'export function render(){ return "rsvp" }';
  const otherMint = (await (
    await put(origin, keyFor(other), other)
  ).json()) as { url: string };
  expect(otherMint.url).not.toBe(minted.url);
});

test('a key that is not derived from the content is refused', async () => {
  const { origin } = await startStore();
  const content = 'export function render(){ return "poll" }';

  // exactly what a regression to a timestamped key would send
  const timestamped = await put(origin, `1724956800-app.js`, content);
  expect(timestamped.status).toBe(400);
  expect(await timestamped.text()).toContain('key-not-content-addressed');

  // and the object was not created under it
  expect((await fetch(`${origin}/1724956800-app.js`)).status).toBe(404);

  // the shape the publisher actually produces is the shape that passes
  expect(UPLOAD_KEY_PATTERN.test(keyFor(content))).toBe(true);
  expect((await put(origin, keyFor(content), content)).status).toBe(201);
});

test('the fixed fixture set still serves as it did, uploads beside it', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-devstore-'));
  const server = await startBundleServer({
    bundles: [
      { name: 'poll.js', content: 'poll' },
      // the oversized fixture: a truthful-looking header over a short body
      { name: 'oversized.js', content: 'short', declaredLength: 320_000 },
    ],
    outDir,
    port: 0,
  });
  running.push(server);

  const poll = await fetch(`${server.origin}/poll.js`);
  expect(poll.status).toBe(200);
  expect(await poll.text()).toBe('poll');

  // `declaredLength` is what the pre-buffer cap check reads; adding the
  // upload path must not have stopped the fixture set advertising a lie
  const oversized = await fetch(`${server.origin}/oversized.js`);
  expect(oversized.headers.get('content-length')).toBe('320000');

  // a fixture name is not an upload key, so the two stores cannot collide
  expect((await put(server.origin, 'poll.js', 'usurped')).status).toBe(400);
  expect(await (await fetch(`${server.origin}/poll.js`)).text()).toBe('poll');
});

/* ------------------------------------------------------------------ */
/* the negative control, both arms                                     */
/* ------------------------------------------------------------------ */

/*
 * FULCRUM. The observed value is `getOrFetchBundle`'s result for a spec
 * whose `sha256` pins the honest bundle. Exactly one thing in this test's
 * world moves it: which bytes the dev store holds at the pinned key. The
 * untampered arm leaves them alone and the surface renders; the tampered
 * arm overwrites them — the modelled threat verbatim, a bucket holder
 * replacing an object — and the same call must refuse.
 *
 * Both arms fetch the SAME url with the SAME ref, so nothing else can
 * account for the difference. The tampered arm additionally asserts the
 * server answered 200 with a non-empty body that is not the honest
 * content, because an unreachable or misnamed fixture would produce
 * `fetch-failed`, which would prove nothing at all about hash checking.
 */

const HONEST = 'export function render(){ return "the real app" }';
const TAMPERED = 'export function render(){ return "attacker payload" }';

async function publishHonest() {
  const store = await startStore();
  const key = keyFor(HONEST);
  const response = await put(store.origin, key, HONEST);
  expect(response.status).toBe(201);
  const { url } = (await response.json()) as { url: string };

  // the spec the channel carries, pinning the honest bytes
  const ref: SurfaceBundleRef = {
    assetRef: url,
    sha256: sha256Hex(HONEST),
    size: Buffer.byteLength(HONEST, 'utf8'),
    shellVersion: 1,
  };
  return { ...store, key, ref };
}

test('untampered: the dev-stored bundle verifies and renders', async () => {
  const { ref } = await publishHonest();

  const result = await getOrFetchBundle(ref, fetchBundle);

  expect(result).toEqual({ status: 'ok', content: HONEST, fromCache: false });
});

test('tampered: the dev-stored bundle lands in hash-mismatch, never renders', async () => {
  const { origin, key, ref } = await publishHonest();

  // the bucket holder overwrites the object at the pinned key
  expect((await put(origin, key, TAMPERED)).status).toBe(201);

  // The bytes really were served: a 404 or a dead socket would give
  // `fetch-failed`, and reading that as success is the trap this asserts
  // its way out of.
  const served = await fetch(ref.assetRef);
  expect(served.status).toBe(200);
  const servedBody = await served.text();
  expect(servedBody.length).toBeGreaterThan(0);
  expect(servedBody).toBe(TAMPERED);
  expect(servedBody).not.toBe(HONEST);

  const result = await getOrFetchBundle(ref, fetchBundle);

  // `surfaceViewState.ts` maps any `unavailable` bundle to
  // `{ kind: 'bundle-unavailable' }` unconditionally, so this is the
  // "can't load this dashboard" state and not a render.
  expect(result).toEqual({ status: 'unavailable', reason: 'hash-mismatch' });
  expect(result).not.toMatchObject({ reason: 'fetch-failed' });
});
