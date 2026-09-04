import { Sha256 } from '@aws-crypto/sha256-js';
import { SURFACE_CAPS, SurfaceBundleRef } from '@tloncorp/api';

import * as db from '../../db';
import { createDevLogger } from '../../debug';

const logger = createDevLogger('surfaceBundleCache', false);

/**
 * Content-addressed bundle cache (plan §3): the hash in the channel's spec
 * is the authority, and this module guarantees that no bytes failing it are
 * ever returned or stored. The network is injected — the cache knows
 * hashes and budgets, never storage URLs or HTTP; `packages/app` supplies
 * the fetcher when it wires the renderer.
 */

/**
 * Byte budget for cached bundles. 16 MB holds 64 maximum-size (256 KB)
 * bundles — far beyond a personal group's dashboard count, small next to
 * the media the app already caches per platform.
 */
export const SURFACE_BUNDLE_CACHE_MAX_BYTES = 16 * 1024 * 1024;

/** Fetches bundle text for a ref, e.g. from remote storage. May throw. */
export type BundleFetcher = (ref: SurfaceBundleRef) => Promise<string>;

export type BundleResult =
  | { status: 'ok'; content: string; fromCache: boolean }
  | { status: 'unavailable'; reason: string };

export async function sha256Hex(text: string): Promise<string> {
  const hash = new Sha256();
  hash.update(text); // strings are hashed as UTF-8
  const digest = await hash.digest();
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function byteLengthOf(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Resolve a bundle by hash: cache first (verify-on-read — a corrupt entry
 * is a miss, not an error), then the injected fetcher, verifying before
 * anything is stored or returned. Hash mismatch and fetch failure are the
 * renderer's "bundle unavailable" state, never a render of unverified
 * bytes.
 */
export async function getOrFetchBundle(
  ref: SurfaceBundleRef,
  fetchBundle: BundleFetcher,
  options: { now?: () => number; maxTotalBytes?: number } = {}
): Promise<BundleResult> {
  const now = options.now ?? Date.now;
  const maxTotalBytes = options.maxTotalBytes ?? SURFACE_BUNDLE_CACHE_MAX_BYTES;

  const cached = await db.getSurfaceBundle({ sha256: ref.sha256 });
  if (cached) {
    if ((await sha256Hex(cached.content)) === ref.sha256) {
      await db.touchSurfaceBundle({ sha256: ref.sha256, at: now() });
      return { status: 'ok', content: cached.content, fromCache: true };
    }
    logger.trackError('corrupt surface bundle cache entry', {
      sha256: ref.sha256,
    });
    await db.deleteSurfaceBundle({ sha256: ref.sha256 });
  }

  let content: string;
  try {
    content = await fetchBundle(ref);
  } catch (error) {
    logger.log('bundle fetch failed', ref.sha256, error);
    return { status: 'unavailable', reason: 'fetch-failed' };
  }

  const byteLength = byteLengthOf(content);
  if (byteLength > SURFACE_CAPS.bundleSize) {
    return { status: 'unavailable', reason: 'oversize' };
  }
  if ((await sha256Hex(content)) !== ref.sha256) {
    // storage is transport, not trust: whoever holds the bucket cannot
    // change what clients run (§3)
    return { status: 'unavailable', reason: 'hash-mismatch' };
  }

  await db.insertSurfaceBundle({
    sha256: ref.sha256,
    content,
    byteLength,
    at: now(),
    maxTotalBytes,
  });
  return { status: 'ok', content, fromCache: false };
}
