/**
 * Load, validate, and upload outbound media for a Tlon post. Only byte-verified
 * PNG/JPEG/GIF/WebP become inline images; failures that prevent a client-viewable
 * result throw, so the model sees a failed tool call rather than a false success.
 *
 * Security invariant (`SECURITY.md` — "Never log or expose credentials"): never
 * expose source paths/URLs or raw loader/upload error text in diagnostics (thrown
 * messages, logs) or in uploaded filenames — a signed query or local path can hide
 * secrets. The full HTTPS URL is preserved only as data for the hotlink fallback,
 * never as diagnostic text.
 */
import { uploadFile } from '@tloncorp/api';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { detectMime, extensionForMime } from 'openclaw/plugin-sdk/media-mime';
// Deprecated barrel, but the only export of buildOutboundMediaLoadOptions, which
// preserves core's host-read byte-verification guard.
import { buildOutboundMediaLoadOptions } from 'openclaw/plugin-sdk/media-runtime';
import type { OutboundMediaLoadOptions } from 'openclaw/plugin-sdk/outbound-media';
import {
  type WebMediaResult,
  loadWebMedia,
} from 'openclaw/plugin-sdk/web-media';

import { getDefaultSsrFPolicy } from './context.js';
import { parseRasterHeader } from './image-dimensions.js';

// OutboundMediaAccess is not exported from this SDK subpath; derive the subset with Pick.
export type OutboundMediaAccessOpts = Pick<
  OutboundMediaLoadOptions,
  'mediaAccess' | 'mediaLocalRoots' | 'mediaReadFile'
>;

export type PreparedOutboundMedia = {
  // Uploaded HTTPS URL, or — on remote-upload-failure fallback — the original
  // userinfo-free HTTPS URL with its query intact (signed hotlinks must stay
  // fetchable). Data only: never use it in diagnostics.
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
 * Only the `://` authority form is rejected. A bare `<word>:<rest>` without `//`
 * — a workspace-relative filename like `report:2026.png`, or a Windows drive path
 * like `C:\…` / `C:/…` — stays a local-path candidate for the root-allowlisted
 * loader to resolve-or-reject against `mediaLocalRoots`.
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
 * filename.
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

export type SvgProbe = 'svg' | 'non-svg' | 'incomplete';

// Preamble openers valid before an XML root element. When the scan window ends
// mid-token on a *proper prefix* of one of these, we can't yet decide, so the
// probe returns 'incomplete' rather than a definitive 'non-svg'. Ordinary
// XML/text (e.g. "<root") is not a prefix of any opener and stays 'non-svg'.
const SVG_PREAMBLE_OPENERS = ['<?', '<!--', '<!doctype', '<svg'];

function isTruncatedOpenerPrefix(rest: string): boolean {
  const r = rest.toLowerCase();
  return SVG_PREAMBLE_OPENERS.some(
    (o) => r.length < o.length && o.startsWith(r)
  );
}

export function probeSvgRoot(text: string, truncated: boolean): SvgProbe {
  const n = text.length;
  let i = 0;
  const skipWs = () => {
    while (i < n && /\s/.test(text[i])) {
      i += 1;
    }
  };
  while (i < n) {
    skipWs();
    if (i >= n) {
      return truncated ? 'incomplete' : 'non-svg';
    }
    if (text[i] !== '<') {
      return 'non-svg';
    }
    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i + 2);
      if (end === -1) {
        return truncated ? 'incomplete' : 'non-svg';
      }
      i = end + 2;
      continue;
    }
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end === -1) {
        return truncated ? 'incomplete' : 'non-svg';
      }
      i = end + 3;
      continue;
    }
    if (/^<!doctype/i.test(text.slice(i, i + 9))) {
      let depth = 0;
      let j = i;
      for (; j < n; j += 1) {
        const c = text[j];
        // A ">" inside a quoted DTD literal does not terminate the DOCTYPE.
        if (c === '"' || c === "'") {
          const quote = c;
          j += 1;
          while (j < n && text[j] !== quote) {
            j += 1;
          }
        } else if (c === '[') {
          depth += 1;
        } else if (c === ']') {
          depth -= 1;
        } else if (c === '>' && depth <= 0) {
          break;
        }
      }
      if (j >= n) {
        return truncated ? 'incomplete' : 'non-svg';
      }
      i = j + 1;
      continue;
    }
    const rest = text.slice(i);
    if (/^<svg/i.test(rest)) {
      const after = rest[4];
      if (after === undefined) {
        // Window ended exactly at "<svg" — the name could continue (e.g.
        // "<svgfoo"), so only treat it as definitive when the whole buffer
        // ends here; otherwise it is undecided.
        return truncated ? 'incomplete' : 'svg';
      }
      return /[\s/>]/.test(after) ? 'svg' : 'non-svg';
    }
    if (truncated && isTruncatedOpenerPrefix(rest)) {
      return 'incomplete';
    }
    return 'non-svg';
  }
  return truncated ? 'incomplete' : 'non-svg';
}

/**
 * Byte-based SVG probe, independent of declared/sniffed MIME. After stripping a
 * leading UTF-8 / UTF-16LE / UTF-16BE BOM and decoding accordingly (file-type
 * sniffs BOM-marked UTF-16 XML as `application/xml`), scans at most 64 KiB of
 * the buffer for a root `<svg` element (after an optional XML declaration,
 * comments, PIs, and DOCTYPE). Returns a tri-state:
 *
 * - 'svg': a root `<svg` element was found within the window.
 * - 'non-svg': a definitive non-SVG root element (or non-markup content) was
 *   reached within the window.
 * - 'incomplete': the 64 KiB window ended while still consuming otherwise-valid
 *   preamble (whitespace/comment/PI/DTD) with more buffer bytes remaining — the
 *   root element was never reached within the scanned window.
 *
 * It only routes SVG to link-vs-reject, so a loose prefix match is sufficient —
 * an SVG is never inlined, so no well-formedness validation is needed.
 */
export function probeSvgBytes(buffer: Buffer | Uint8Array): SvgProbe {
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
  const windowEnd = Math.min(bytes.length, offset + 65536);
  const truncated = windowEnd < bytes.length;
  const slice = bytes.subarray(offset, windowEnd);
  const text = new TextDecoder(encoding).decode(slice);
  return probeSvgRoot(text, truncated);
}

export function isSvgBytes(buffer: Buffer | Uint8Array): boolean {
  return probeSvgBytes(buffer) === 'svg';
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
    base = `upload-${Date.now()}-${randomUUID()}`;
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
 * structural header checks + a present, matching byte sniff). Local SVG and
 * malformed/unsupported image claims reject with an actionable "convert to
 * PNG/JPEG" error; remote SVG and non-image media become links.
 */
export function classifyLoadedMedia(params: {
  buffer: Buffer | Uint8Array;
  loaderMime?: string; // loader-resolved contentType (detectMime byte-sniff precedence already applied by core)
  sniffedMime?: string; // await detectMime({ buffer }) — byte sniff only
  isRemote: boolean;
  // Fixed diagnostic placeholder only; never source text (see LOCAL/REMOTE_MEDIA_LABEL).
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

  const svgProbe = probeSvgBytes(buffer);
  if (svgProbe === 'svg') {
    if (!isRemote) {
      throw new Error(
        "SVG files can't be posted as images — convert it to PNG (or upload it and send the URL)"
      );
    }
    return { kind: 'link', effectiveMime: 'image/svg+xml' };
  }
  // Fail closed for local files: a long valid preamble may still hide an SVG root.
  if (svgProbe === 'incomplete' && !isRemote) {
    throw new Error(
      "SVG files can't be posted as images — convert it to PNG (or upload it and send the URL)"
    );
  }

  // Byte sniff outranks the loader MIME. A sniffed parser-supported raster whose
  // header did not parse is malformed — never fall through and post at 0×0.
  if (sniffedCanon && PARSEABLE_MIMES.has(sniffedCanon)) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  // Any other sniffed image format (AVIF/HEIC/BMP/ICO …) is valid but not inlined;
  // the sniff wins over a conflicting loader MIME so the convert-hint fires.
  if (sniffedCanon?.startsWith('image/')) {
    const fmt = sniffedCanon.slice('image/'.length);
    throw new Error(
      `Media "${sourceLabel}" is a ${fmt} image that can't be posted inline — convert it to PNG or JPEG first`
    );
  }

  // No sniff: fall back to the loader MIME, still rejecting a declared
  // parser-supported format whose header did not parse.
  if (loaderCanon && PARSEABLE_MIMES.has(loaderCanon)) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  if (loaderCanon?.startsWith('image/')) {
    throw new Error(`Media "${sourceLabel}" is not a valid image`);
  }

  return { kind: 'link', effectiveMime: loaderCanon };
}

/**
 * Fixed placeholders substituted for the real source in all diagnostics (error
 * text and logs). The label is ALWAYS one of these constants — never derived
 * from the path/URL: a denylist can't be airtight (a secret needs no special
 * character to hide in ordinary-looking path or host text). The real path/URL
 * stays data-only — used for the SVG check, filesystem reads, fetching, and the
 * HTTPS hotlink fallback, which does put the original URL in the outbound post.
 */
const LOCAL_MEDIA_LABEL = '[local media reference]';
const REMOTE_MEDIA_LABEL = '[remote media reference]';

function isTlonHostingForced(): boolean {
  const raw = (process.env.TLON_HOSTING ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

// Require a directly fetchable HTTPS URL: no userinfo or fragment; queries allowed.
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
 * with an actionable message. `normalized` may contain signed-query secrets —
 * return it as fallback data only, never in diagnostic text.
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
      // Accepted residual: the loader doesn't expose a redirect's final URL, so
      // an https source that redirects to http may still fail as a hotlink.
      // Revisit if WebMediaResult exposes finalUrl or can enforce https.
      //
      // Use log, not warn: warnings from this subsystem are absent from harness/CI
      // output. Keep the text fixed — upload errors may contain secrets.
      console.log('[tlon] upload: failed, hotlinking original URL');
      return { url: normalized, isImage, width, height, contentType };
    }
    throw new Error(
      `Failed to upload media "${sourceLabel}": Media upload failed`
    );
  }

  // Exact-match the one stable uploadFile literal. Its other failures have no
  // structured discriminator, so never parse or echo their free-text message.
  if (cause === 'No storage credentials configured') {
    throw new Error(
      `Failed to upload local media "${sourceLabel}" to Tlon storage: No storage credentials configured — the ship has no storage configured; configure S3/hosted storage, or pass a public https URL instead.`
    );
  }
  throw new Error(
    `Failed to upload local media "${sourceLabel}" to Tlon storage: Media upload failed`
  );
}

export async function prepareOutboundMedia(
  mediaUrl: string,
  opts: OutboundMediaAccessOpts
): Promise<PreparedOutboundMedia> {
  const normalized = normalizeMediaUrl(mediaUrl);
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

  // Fixed diagnostic placeholder, never caller-controlled source text.
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
    // describeLoadError returns a fixed phrase; raw err never interpolated.
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

  // Synthetic name only: local paths and remote URL components may contain secrets.
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
    // Raw upload text goes only to handleUploadFailure's exact-literal check.
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
