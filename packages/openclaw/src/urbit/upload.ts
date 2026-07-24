/**
 * Prepare outbound media for a Tlon post.
 *
 * Replaces the old `uploadImageFromUrl`, which only understood http(s) URLs and
 * silently returned the input on any failure (so a server-local `/pier/...png`
 * path was posted as an image block clients could never load, while the tool
 * still reported `sent`). This pipeline:
 *
 * - loads remote URLs and workspace-local paths through OpenClaw core's
 *   root-allowlisted, byte-verified loader (`loadWebMedia` +
 *   `buildOutboundMediaLoadOptions`);
 * - classifies the loaded bytes into an inline image (PNG/JPEG/GIF/WebP with
 *   real dimensions and a matching byte sniff) or a link, rejecting malformed,
 *   spoofed, or unrenderable image claims instead of posting them;
 * - uploads to Tlon storage with a sanitized filename and a byte-verified MIME;
 * - throws on any failure that would prevent a client-viewable result, so the
 *   model sees a failed tool call rather than a false success.
 *
 * Security invariants: never log or expose URL credentials or signed-query
 * secrets (`SECURITY.md` — "Never log or expose credentials"); sanitization
 * applies to error text/logs/labels/filenames only, never to the URL that gets
 * posted (stripping `?sig=…` would break signed hotlinks while reporting
 * success).
 */
import { uploadFile } from '@tloncorp/api';
import { fileURLToPath } from 'node:url';
import { detectMime, extensionForMime } from 'openclaw/plugin-sdk/media-mime';
// media-runtime is a deprecated barrel, but it is the ONLY export path for
// buildOutboundMediaLoadOptions. We use it specifically to preserve core's
// hostReadCapability byte-verification guard on host reads.
import { buildOutboundMediaLoadOptions } from 'openclaw/plugin-sdk/media-runtime';
import type { OutboundMediaLoadOptions } from 'openclaw/plugin-sdk/outbound-media';
import {
  type WebMediaResult,
  loadWebMedia,
} from 'openclaw/plugin-sdk/web-media';

import { getDefaultSsrFPolicy } from './context.js';
import { parseRasterHeader } from './image-dimensions.js';

// NOTE: OutboundMediaAccess is NOT exported from the outbound-media subpath at
// core 2026.5.28 — derive the option types with Pick instead of importing it.
export type OutboundMediaAccessOpts = Pick<
  OutboundMediaLoadOptions,
  'mediaAccess' | 'mediaLocalRoots' | 'mediaReadFile'
>;

export type PreparedOutboundMedia = {
  // Uploaded URL (validated https, no userinfo) — or, on the remote-upload-failure
  // fallback, the full normalized credential-free ORIGINAL url INCLUDING its query
  // (signed URLs must remain fetchable; sanitization is for error text/logs only).
  url: string;
  isImage: boolean;
  width: number;
  height: number;
  contentType?: string;
};

type ClassifiedMedia =
  | { kind: 'image'; width: number; height: number; effectiveMime: string }
  | { kind: 'link'; effectiveMime?: string };

const PARSEABLE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const MAX_SIDE_PX = 16384;
const MAX_PIXELS = 50_000_000;

/**
 * Lowercase a MIME and canonicalize the raster aliases core preserves from
 * non-canonical response headers (`image/jpg`, `image/pjpeg` → `image/jpeg`;
 * `image/x-png` → `image/png`).
 */
function canon(mime: string | undefined): string | undefined {
  if (!mime) {
    return undefined;
  }
  const m = mime.trim().toLowerCase();
  if (!m) {
    return undefined;
  }
  if (m === 'image/jpg' || m === 'image/pjpeg') {
    return 'image/jpeg';
  }
  if (m === 'image/x-png') {
    return 'image/png';
  }
  return m;
}

/**
 * Strip the agent-tool `MEDIA:` prefix exactly the way core does, then trim.
 * A `media://` value is a protocol-like reference and is left intact.
 */
function normalizeMediaUrl(mediaUrl: string): string {
  let value = mediaUrl;
  if (!/^\s*media:\/\//i.test(value)) {
    value = value.replace(/^\s*MEDIA\s*:\s*/i, '');
  }
  return value.trim();
}

/**
 * Detect an authority-form URL (`<scheme>://…`) whose scheme is NOT one the
 * pipeline handles (http/https remote, `media://` passthrough, `file://` local).
 *
 * Only the `://` authority form is rejected here. A bare `<word>:<rest>` without
 * `//` — e.g. a workspace-relative filename like `report:2026.png`, or a Windows
 * drive path like `C:\…` / `C:/…` — is an ordinary local path and is left for the
 * root-allowlisted loader to resolve-or-reject against `mediaLocalRoots`. The
 * credential-leak boundary is the output side (fixed category phrases plus the
 * origin+pathname / placeholder source labels), so a non-allowed scheme that
 * lacks the authority form can no longer leak even if it reaches local handling.
 */
function isDisallowedAuthorityScheme(value: string): boolean {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(value);
  if (!m) {
    return false;
  }
  const scheme = m[1].toLowerCase();
  return (
    scheme !== 'http' &&
    scheme !== 'https' &&
    scheme !== 'media' &&
    scheme !== 'file'
  );
}

/**
 * Map a loader failure to one of a bounded set of fixed, actionable phrases.
 *
 * Reads ONLY a typed discriminator from the caught error — the first non-empty
 * string among `err.code`, `err.kind`, then `err.name` (the structured fields
 * OpenClaw core's `LocalMediaAccessError.code` and `MediaFetchError.code`
 * expose) — and compares it against a known allowlist of category tokens. The
 * raw `err.message` is never consulted: it is unbounded free text that may carry
 * credentials or signed-query secrets, so it must never reach an error, log, or
 * filename. This is both actionable (file-not-found vs path-not-allowed vs
 * too-large vs fetch-failed) and airtight (a bounded allowlist of typed
 * discriminator strings mapped to fixed phrases we author).
 */
function describeLoadError(err: unknown): string {
  const e = err as { code?: unknown; kind?: unknown; name?: unknown };
  let discriminator: string | undefined;
  for (const candidate of [e?.code, e?.kind, e?.name]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      discriminator = candidate;
      break;
    }
  }
  switch (discriminator) {
    case 'not-found':
      return 'Media file not found';
    case 'not-file':
      return 'Media path is not a file';
    case 'path-not-allowed':
      // Core emits this both for out-of-root paths and for host-read
      // byte-type rejections (e.g. plaintext named .png), so the phrase
      // covers path and file-type disallowance without over-claiming which.
      return 'Media path or file type is not allowed';
    case 'invalid-file-url':
    case 'invalid-path':
    case 'network-path-not-allowed':
    case 'unsafe-bypass':
      return 'Invalid media path';
    case 'invalid-root':
      return 'Media access roots are misconfigured';
    case 'max_bytes':
      return 'Media file is too large';
    case 'http_error':
      return 'Media URL returned an HTTP error';
    case 'fetch_failed':
      return 'Failed to fetch media';
    default:
      return 'Failed to read media';
  }
}

/**
 * Decode a local reference for path inspection. `file://` URLs are converted
 * with `fileURLToPath` (which decodes percent-encoding) — core decodes them
 * before reading, so a raw-string check is bypassed by `file:///ws/image%2Esvg`
 * otherwise.
 */
function decodeLocalPath(normalized: string): string {
  if (/^file:\/\//i.test(normalized)) {
    try {
      return fileURLToPath(normalized);
    } catch {
      throw new Error('Invalid media URL');
    }
  }
  return normalized;
}

function isSvgPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.svg');
}

function hasSvgRoot(text: string): boolean {
  const n = text.length;
  let i = 0;
  const skipWs = () => {
    while (i < n && /\s/.test(text[i])) {
      i += 1;
    }
  };
  while (i < n) {
    skipWs();
    if (i >= n || text[i] !== '<') {
      return false;
    }
    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i + 2);
      if (end === -1) {
        return false;
      }
      i = end + 2;
      continue;
    }
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end === -1) {
        return false;
      }
      i = end + 3;
      continue;
    }
    if (/^<!doctype/i.test(text.slice(i, i + 9))) {
      let depth = 0;
      let j = i;
      for (; j < n; j += 1) {
        const c = text[j];
        if (c === '"' || c === "'") {
          // Skip quoted string content (e.g. a SYSTEM/PUBLIC literal that
          // contains '>') so a quoted '>' doesn't terminate the DOCTYPE early.
          const quote = c;
          j += 1;
          while (j < n && text[j] !== quote) {
            j += 1;
          }
          // j sits on the closing quote (or n); the loop's j+=1 steps past it.
        } else if (c === '[') {
          depth += 1;
        } else if (c === ']') {
          depth -= 1;
        } else if (c === '>' && depth <= 0) {
          break;
        }
      }
      if (j >= n) {
        return false;
      }
      i = j + 1;
      continue;
    }
    const rest = text.slice(i);
    if (/^<svg/i.test(rest)) {
      const after = rest[4];
      return after === undefined || /[\s/>]/.test(after);
    }
    return false;
  }
  return false;
}

/**
 * Byte-based SVG detection, independent of declared/sniffed MIME. After
 * stripping a leading UTF-8 / UTF-16LE / UTF-16BE BOM and decoding accordingly
 * (file-type sniffs BOM-marked UTF-16 XML as `application/xml`), reports
 * whether the buffer exposes a root `<svg` element within the first few KB
 * (after an optional XML declaration, comments, PIs, and DOCTYPE). It only
 * routes SVG to link-vs-reject, so a loose prefix match is sufficient — an SVG
 * is never inlined, so no well-formedness validation is needed.
 */
export function isSvgBytes(buffer: Buffer | Uint8Array): boolean {
  const bytes = buffer as Uint8Array;
  let offset = 0;
  let encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8';
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    offset = 3;
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    offset = 2;
    encoding = 'utf-16le';
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    offset = 2;
    encoding = 'utf-16be';
  }
  const slice = bytes.subarray(offset, Math.min(bytes.length, offset + 8192));
  // Node's WHATWG TextDecoder supports the `utf-16be` label directly, so decode
  // with the detected encoding rather than byte-swapping to LE first.
  const text = new TextDecoder(encoding).decode(slice);
  return hasSvgRoot(text);
}

function cleanFileNameSegment(segment: string): string {
  return segment
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);
}

/**
 * Sanitize a candidate upload filename to a bounded `[A-Za-z0-9._-]` allowlist
 * and force the canonical extension for `effectiveMime`.
 *
 * `uploadFile` embeds the name verbatim into the storage object key and
 * custom-storage builds the public URL with `new URL(fileKey, publicUrlBase)`,
 * so a name containing `#`, `?`, whitespace, or percent-encoding yields a
 * syntactically valid but wrong URL (the `#…` becomes a fragment) — a fresh
 * false-success path. The canonical extension replaces any mismatched one (an
 * SVG loaded from `diagram.xml` must become `….svg`, not keep `.xml`).
 */
export function safeUploadFileName(
  name: string,
  effectiveMime: string | undefined
): string {
  const dotIdx = name.lastIndexOf('.');
  let base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  base = cleanFileNameSegment(base);
  if (!base) {
    base = `upload-${Date.now()}`;
  }
  const canonicalExt = extensionForMime(effectiveMime);
  if (canonicalExt) {
    return `${base}.${canonicalExt.replace(/^\./, '')}`;
  }
  if (dotIdx > 0) {
    const ext = cleanFileNameSegment(name.slice(dotIdx + 1));
    if (ext) {
      return `${base}.${ext}`;
    }
  }
  return base;
}

/**
 * Pure classifier deciding whether loaded bytes become an inline image block or
 * a link, and the authoritative `effectiveMime` to upload/store with. Throws on
 * malformed, spoofed, or unrenderable image claims and on local SVG.
 *
 * The only formats posted as an inline image block are the four
 * `parseRasterHeader` formats (PNG/JPEG/GIF/WebP — real dimensions + bounded
 * structural header checks + a present, matching byte sniff). Everything else
 * is either rejected with an actionable "convert to PNG/JPEG" error or, for
 * SVG, posted as a link — never as an inline image block.
 */
export function classifyLoadedMedia(params: {
  buffer: Buffer | Uint8Array;
  loaderMime?: string; // loader-resolved contentType (detectMime byte-sniff precedence already applied by core)
  sniffedMime?: string; // await detectMime({ buffer }) — byte sniff only
  isRemote: boolean;
  sourceLabel: string;
}): ClassifiedMedia {
  const { buffer, loaderMime, sniffedMime, isRemote, sourceLabel } = params;
  const loaderCanon = canon(loaderMime);
  const sniffedCanon = canon(sniffedMime);

  const raster = parseRasterHeader(buffer);
  if (raster) {
    const { format, width, height } = raster;
    const inBounds =
      width > 0 &&
      height > 0 &&
      width <= MAX_SIDE_PX &&
      height <= MAX_SIDE_PX &&
      width * height <= MAX_PIXELS;
    // A genuine PNG/JPEG/GIF/WebP always sniffs at signature level, so require a
    // present, matching byte sniff — an absent sniff, a different image type, or
    // a non-image type rejects crafted magic-only files.
    const sniffMatches = sniffedCanon === `image/${format}`;
    if (!inBounds || !sniffMatches) {
      throw new Error(`Media "${sourceLabel}" is not a valid ${format} image`);
    }
    return {
      kind: 'image',
      width,
      height,
      effectiveMime: `image/${format}`,
    };
  }

  if (isSvgBytes(buffer)) {
    if (!isRemote) {
      throw new Error(
        "SVG files can't be posted as images — convert it to PNG (or upload it and send the URL)"
      );
    }
    return { kind: 'link', effectiveMime: 'image/svg+xml' };
  }

  // A definitive byte sniff is ground truth about the content, so it is checked
  // before the loader-resolved content type (which core's detectMime already
  // gives byte-sniff precedence to, but may still be a generic container type).
  //
  // 1. A sniff for a parser-supported format (PNG/JPEG/GIF/WebP) whose header
  //    did not parse must never fall through — garbage/truncated bytes must not
  //    post at 0×0.
  if (sniffedCanon && PARSEABLE_MIMES.has(sniffedCanon)) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  // 2. A sniff for any other image format (AVIF/HEIC/HEIF/BMP/ICO …) is a valid
  //    image we don't inline. This takes precedence over a conflicting
  //    loader-resolved content type: bytes that definitively sniff as AVIF are
  //    AVIF even if the loader resolved `image/jpeg`, so the actionable
  //    convert-hint wins over the generic "not a valid image".
  if (sniffedCanon?.startsWith('image/')) {
    const fmt = sniffedCanon.slice('image/'.length);
    throw new Error(
      `Media "${sourceLabel}" is a ${fmt} image that can't be posted inline — convert it to PNG or JPEG first`
    );
  }

  // 3. No definitive sniff: fall back to the loader-resolved content type. A
  //    loader-resolved parser-supported format whose header did not parse must
  //    not fall through.
  if (loaderCanon && PARSEABLE_MIMES.has(loaderCanon)) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  if (loaderCanon?.startsWith('image/')) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  return { kind: 'link', effectiveMime: loaderCanon };
}

/**
 * The local sourceLabel used in error messages is ALWAYS this fixed placeholder
 * — no pattern-matching, no conditional detection. A denylist of suspicious
 * characters can never be airtight (a secret needs no special character to exist
 * inside ordinary-looking path text), so caller/model-controlled local path text
 * never reaches error messages. The decoded local path is still used internally
 * for the SVG check and filesystem reads; this constant only controls what
 * appears in error message text.
 */
const LOCAL_MEDIA_LABEL = '[local media reference]';

/**
 * The remote sourceLabel used in error messages is ALWAYS this fixed placeholder.
 * Hostnames, subdomains, and path segments can themselves carry tokens or secrets,
 * so no part of the URL reaches error text or logs. The full normalized URL is
 * still used internally for fetching and hotlink fallback; this constant only
 * controls what appears in error message text.
 */
const REMOTE_MEDIA_LABEL = '[remote media reference]';

function isTlonHostingForced(): boolean {
  const raw = (process.env.TLON_HOSTING ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function isValidUploadedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') {
      return false;
    }
    if (u.username || u.password) {
      return false;
    }
    if (u.hash !== '') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function bytesToBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    bytes.buffer as ArrayBuffer,
    bytes.byteOffset,
    bytes.byteLength
  );
}

/**
 * Apply the upload-failure policy. Remote https sources fall back to hotlinking
 * the full normalized original URL (including its signed query); remote http
 * sources throw (mixed content in the https web client); local sources throw
 * with an actionable message.
 */
function handleUploadFailure(params: {
  isRemote: boolean;
  normalized: string;
  sourceLabel: string;
  cause: string;
  isImage: boolean;
  width: number;
  height: number;
  contentType: string | undefined;
}): PreparedOutboundMedia {
  const {
    isRemote,
    normalized,
    sourceLabel,
    cause,
    isImage,
    width,
    height,
    contentType,
  } = params;

  if (isRemote) {
    if (/^https:\/\//i.test(normalized)) {
      // console.log, not console.warn: warn-level output from this subsystem
      // does not surface in the harness/CI container logs, which made upload
      // failures fully silent (source-URL fallback with no visible cause). A
      // fixed category phrase is logged — the raw upload error is never
      // interpolated, since it may carry credentials or signed-query secrets.
      console.log('[tlon] upload: failed, hotlinking original URL');
      return { url: normalized, isImage, width, height, contentType };
    }
    throw new Error(
      `Failed to upload media "${sourceLabel}": Media upload failed`
    );
  }

  // The exact-equality check against a known literal thrown by @tloncorp/api's
  // uploadFile is safe — it compares against a fixed string we author, never
  // echoing unbounded error text. uploadFile's other failures expose no reliable
  // bounded discriminator (the HTTP status is interpolated into the free-text
  // message, with no structured .code/.status field to read), so they keep the
  // generic 'Media upload failed' phrase rather than a category parsed from text.
  if (cause === 'No storage credentials configured') {
    throw new Error(
      `Failed to upload local media "${sourceLabel}" to Tlon storage: No storage credentials configured — the ship has no storage configured; configure S3/hosted storage, or pass a public https URL instead.`
    );
  }
  throw new Error(
    `Failed to upload local media "${sourceLabel}" to Tlon storage: Media upload failed`
  );
}

/**
 * Load, classify, and upload outbound media, returning a client-viewable result
 * or throwing so the model sees a failed tool call.
 */
export async function prepareOutboundMedia(
  mediaUrl: string,
  opts: OutboundMediaAccessOpts
): Promise<PreparedOutboundMedia> {
  const normalized = normalizeMediaUrl(mediaUrl);
  // Scheme guard: reject only authority-form URLs (`<scheme>://…`) whose scheme
  // is not one the pipeline handles (http/https remote, media:// passthrough,
  // file:// local) — e.g. ftp://, data://, ws://. A bare `<word>:<rest>` without
  // `//` (a workspace-relative `report:2026.png`, a Windows drive path) is an
  // ordinary local path and is left for the root-allowlisted loader to
  // resolve-or-reject; the output-side sanitization is the credential-leak
  // boundary, so such an input can no longer leak even if it reaches local
  // handling.
  if (isDisallowedAuthorityScheme(normalized)) {
    throw new Error('Invalid media URL');
  }
  const isRemoteScheme = /^https?:\/\//i.test(normalized);
  let remoteUrl: URL | undefined;
  if (isRemoteScheme) {
    try {
      remoteUrl = new URL(normalized);
    } catch {
      throw new Error('Invalid media URL');
    }
  }
  const isRemote = remoteUrl !== undefined;

  if (remoteUrl) {
    if (remoteUrl.username || remoteUrl.password) {
      throw new Error('Media URLs with embedded credentials are not supported');
    }
  } else if (isSvgPath(decodeLocalPath(normalized))) {
    throw new Error(
      "SVG files can't be posted as images — convert it to PNG (or upload it and send the URL)"
    );
  }

  // sourceLabel is safe by construction: remote sources use the fixed
  // REMOTE_MEDIA_LABEL placeholder and local sources use the fixed
  // LOCAL_MEDIA_LABEL placeholder, so caller/model-controlled text never
  // reaches an error message. The local path is decoded once above for the
  // SVG check and is not re-decoded here.
  const sourceLabel = remoteUrl ? REMOTE_MEDIA_LABEL : LOCAL_MEDIA_LABEL;

  let media: WebMediaResult;
  try {
    media = await loadWebMedia(normalized, {
      ...buildOutboundMediaLoadOptions({
        mediaAccess: opts.mediaAccess,
        mediaLocalRoots: opts.mediaLocalRoots,
        mediaReadFile: opts.mediaReadFile,
        optimizeImages: false,
      }),
      ssrfPolicy: getDefaultSsrFPolicy(),
    });
  } catch (err) {
    // describeLoadError maps a bounded allowlist of typed discriminator strings
    // (err.code/kind/name) to fixed phrases — the loader's raw err.message
    // (unbounded free text, may contain secrets) is never interpolated.
    throw new Error(
      `Cannot read media "${sourceLabel}": ${describeLoadError(err)}`
    );
  }

  const buffer = media.buffer;
  const sniffedMime = await detectMime({ buffer });

  const classified = classifyLoadedMedia({
    buffer,
    loaderMime: media.contentType,
    sniffedMime,
    isRemote,
    sourceLabel,
  });

  const isImage = classified.kind === 'image';
  const effectiveMime = classified.effectiveMime ?? media.contentType;
  const width = classified.kind === 'image' ? classified.width : 0;
  const height = classified.kind === 'image' ? classified.height : 0;

  // Never derive the uploaded filename from caller-controlled text. Both local
  // and remote sources get a synthetic filename (upload-<timestamp>.<ext>).
  // Remote URL path segments can carry secrets, so no part of the URL reaches
  // the storage object key.
  const fileName = safeUploadFileName('', effectiveMime);

  let uploadedUrl: string;
  try {
    const result = await uploadFile({
      blob: new Blob([bytesToBlobPart(buffer)], { type: effectiveMime }),
      fileName,
      contentType: effectiveMime,
      ...(isTlonHostingForced()
        ? { hostedDetection: 'assume-hosted' as const }
        : {}),
    });
    uploadedUrl = result.url;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    return handleUploadFailure({
      isRemote,
      normalized,
      sourceLabel,
      cause,
      isImage,
      width,
      height,
      contentType: effectiveMime,
    });
  }

  if (!isValidUploadedUrl(uploadedUrl)) {
    return handleUploadFailure({
      isRemote,
      normalized,
      sourceLabel,
      cause: 'the storage endpoint returned an unusable URL',
      isImage,
      width,
      height,
      contentType: effectiveMime,
    });
  }

  return {
    url: uploadedUrl,
    isImage,
    width,
    height,
    contentType: effectiveMime,
  };
}
