import { getCurrentUserIsHosted, scry, uploadFile } from '@tloncorp/api';
import crypto from 'node:crypto';
import {
  detectMime,
  extensionForMime,
  normalizeMimeType,
} from 'openclaw/plugin-sdk/media-mime';
import { readResponseWithLimit } from 'openclaw/plugin-sdk/response-limit-runtime';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';

import { getDefaultSsrFPolicy } from './context.js';

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const FETCH_DEADLINE_MS = 30_000;

const LOCAL_MEDIA_ERROR =
  'Local file paths are not supported on this channel — upload the file first (e.g. `tlon upload <path>`) and resend with the returned https URL.';
const HTTPS_ONLY_ERROR = 'Only https media URLs are supported.';
const USERINFO_ERROR =
  'Media URLs with embedded credentials are not supported.';
const INVALID_MEDIA_ERROR =
  'Invalid media URL — pass a public https URL. If this is a local file, upload it first (e.g. `tlon upload <path>`) and resend with the returned https URL.';
const FETCH_FAILED_ERROR = 'Could not fetch media from the provided URL.';

export type ClassifiedInput =
  | { kind: 'https'; canonical: string }
  | { kind: 'local' }
  | { kind: 'http' }
  | { kind: 'userinfo' }
  | { kind: 'invalid' };

export function classifyInput(raw: string): ClassifiedInput {
  const value = normalizeMediaUrl(raw);

  if (
    /^[A-Za-z]:/.test(value) ||
    value.startsWith('\\') ||
    /^\.\.?[\\/]/.test(value) ||
    value.startsWith('~') ||
    (/^\//.test(value) && !value.startsWith('//')) ||
    /^\/{3,}/.test(value)
  ) {
    return { kind: 'local' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { kind: 'invalid' };
  }

  if (parsed.protocol === 'file:') {
    return { kind: 'local' };
  }

  if (parsed.protocol === 'http:') {
    return { kind: 'http' };
  }

  if (parsed.protocol === 'https:') {
    if (!/^https:\/\/[^/\\]/i.test(value)) {
      return { kind: 'invalid' };
    }
    if (
      parsed.username ||
      parsed.password ||
      /^https:\/\/[^/?#\\]*@/i.test(value)
    ) {
      return { kind: 'userinfo' };
    }
    return { kind: 'https', canonical: parsed.href };
  }

  return { kind: 'invalid' };
}

function normalizeMediaUrl(raw: string): string {
  let value = raw.trim();
  if (!/^\s*media:\/\//i.test(value)) {
    value = value.replace(/^\s*MEDIA\s*:\s*/i, '');
  }
  return value;
}

function strictPostableUrl(u: string): string | null {
  if (u !== u.trim()) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (!/^https:\/\/[^/\\]/i.test(u)) {
    return null;
  }
  if (parsed.username || parsed.password || /^https:\/\/[^/?#\\]*@/i.test(u)) {
    return null;
  }
  return parsed.href;
}

function isTlonHostingForced(): boolean {
  const raw = (process.env.TLON_HOSTING ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Whether `uploadFile` could actually store bytes for this ship.
 *
 * Mirrors `uploadFile`'s own backend routing (`@tloncorp/api`
 * `storageApi.ts`) rather than assuming one backend: it picks Memex when the
 * client is a hosted node and either the service is `presigned-url` or custom
 * S3 credentials are absent; otherwise it needs custom S3 credentials, plus a
 * current bucket for the S3 operation itself.
 *
 * The point of checking first is bot moons: they are reached over
 * localhost/proxy (so they are not hosted nodes by URL) and carry no storage
 * config, so calling `uploadFile` would fail on every single send. Skipping the
 * call keeps that path quiet. Genuinely hosted ships still reach Memex.
 */
async function shipCanStoreUploads(): Promise<boolean> {
  try {
    const [rawCreds, rawConfig] = await Promise.all([
      scry<{
        'storage-update': {
          credentials: {
            accessKeyId?: string;
            endpoint?: string;
            secretAccessKey?: string;
          };
        };
      }>({ app: 'storage', path: '/credentials' }),
      scry<{
        'storage-update': {
          configuration: { currentBucket?: string; service?: string };
        };
      }>({ app: 'storage', path: '/configuration' }),
    ]);
    const creds = rawCreds['storage-update'].credentials;
    const config = rawConfig['storage-update'].configuration;

    const hasCustomS3 = Boolean(
      creds.accessKeyId && creds.endpoint && creds.secretAccessKey
    );

    // A fresh ship bunts `service` to `%credentials`; hosted infra (tlonbot's
    // entrypoint) pokes bot moons to `%presigned-url`; the `|| !hasCustomS3`
    // disjunct is what actually routes creds-less hosted ships to memex.
    if (
      isHostedClient() &&
      (config.service === 'presigned-url' || !hasCustomS3)
    ) {
      return true;
    }

    return hasCustomS3 && Boolean(config.currentBucket);
  } catch {
    return false;
  }
}

function isHostedClient(): boolean {
  try {
    return isTlonHostingForced() || getCurrentUserIsHosted();
  } catch {
    return false;
  }
}

function syntheticUploadFileName(mime: string): string {
  const ext = extensionForMime(mime) ?? '.bin';
  return `upload-${Date.now()}-${crypto.randomUUID()}${ext}`;
}

export async function prepareOutboundMedia(
  mediaUrl: string
): Promise<{ url: string; isImage: boolean }> {
  const classified = classifyInput(mediaUrl);

  switch (classified.kind) {
    case 'local':
      throw new Error(LOCAL_MEDIA_ERROR);
    case 'http':
      throw new Error(HTTPS_ONLY_ERROR);
    case 'userinfo':
      throw new Error(USERINFO_ERROR);
    case 'invalid':
      throw new Error(INVALID_MEDIA_ERROR);
    case 'https':
      break;
  }

  const canonical = classified.canonical;

  let response: Response;
  let finalUrl: string;
  let release: () => Promise<void>;
  try {
    ({ response, finalUrl, release } = await fetchWithSsrFGuard({
      url: canonical,
      init: { method: 'GET' },
      policy: getDefaultSsrFPolicy(),
      auditContext: 'tlon-media',
      requireHttps: true,
      signal: AbortSignal.timeout(FETCH_DEADLINE_MS),
    }));
  } catch {
    throw new Error(FETCH_FAILED_ERROR);
  }

  let buffer: Buffer;
  try {
    try {
      if (!response.ok) {
        throw new Error(FETCH_FAILED_ERROR);
      }
      if (new URL(finalUrl).protocol !== 'https:') {
        throw new Error(FETCH_FAILED_ERROR);
      }
      buffer = await readResponseWithLimit(response, MAX_MEDIA_BYTES);
    } finally {
      // Cleanup runs inside the outer try so a rejecting release() is remapped
      // to the fixed phrase too, instead of surfacing its own message.
      await release();
    }
  } catch {
    throw new Error(FETCH_FAILED_ERROR);
  }

  const sniffedMime = await detectMime({ buffer });
  const headerMime = normalizeMimeType(response.headers.get('content-type'));
  const effectiveMime = sniffedMime ?? headerMime ?? 'application/octet-stream';

  let isImage: boolean;
  if (sniffedMime) {
    isImage = sniffedMime.startsWith('image/');
  } else if (headerMime === 'image/svg+xml') {
    isImage = true;
  } else {
    isImage = false;
  }

  const capable = await shipCanStoreUploads();
  if (!capable) {
    return { url: canonical, isImage };
  }

  try {
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    const blob = new Blob([ab], { type: effectiveMime });
    const fileName = syntheticUploadFileName(effectiveMime);
    const result = await uploadFile({
      blob,
      fileName,
      contentType: effectiveMime,
      ...(isTlonHostingForced()
        ? { hostedDetection: 'assume-hosted' as const }
        : {}),
    });
    const postable = strictPostableUrl(result.url);
    if (postable) {
      return { url: postable, isImage };
    }
    console.log('[tlon] media: upload result not postable, using source URL');
    return { url: canonical, isImage };
  } catch {
    console.log('[tlon] media: upload failed, using source URL');
    return { url: canonical, isImage };
  }
}
