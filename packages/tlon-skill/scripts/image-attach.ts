/**
 * Attach images to outgoing messages as Tlon story image blocks.
 *
 * Tlon clients lay out image blocks from their declared width/height, so the
 * dimensions must be real. The image bytes are fetched (typically from the URL
 * `tlon upload` just returned) and the dimensions sniffed from the header —
 * PNG, JPEG, GIF, and WebP are supported.
 *
 * `--image` carries the fail-loud outbound-media contract (TLON-6318): the URL
 * is classified before any network call (local paths, plain http, embedded
 * credentials, and malformed input each throw their own fixed error), then
 * fetched through the pinned SSRF guard under a 30s deadline and a 10 MiB
 * streamed cap. Content decides image-vs-reject: the dimension sniff reads the
 * actual bytes and the extension is never consulted.
 */
import { commandError, usageError } from './commands/command';
import type { StoryVerse } from './markdown';
import {
  HTTPS_ONLY_ERROR,
  INVALID_MEDIA_ERROR,
  LOCAL_MEDIA_ERROR,
  USERINFO_ERROR,
  classifyMediaUrl,
  fetchGuardedMedia,
} from './media-guard';

/** Single wall-clock budget for the whole `--image` fetch, per the contract. */
export const IMAGE_FETCH_DEADLINE_MS = 30_000;
/** Streamed cap on decoded image bytes. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function u16be(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function u32be(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function u16le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function u24le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

function u32le(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function ascii(b: Uint8Array, o: number, len: number): string {
  return String.fromCharCode(...b.subarray(o, o + len));
}

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Sniff pixel dimensions from raster image bytes (PNG/JPEG/GIF/WebP).
 * Returns null when the format is unrecognized or the header is malformed.
 */
export function imageDimensions(bytes: Uint8Array): ImageSize | null {
  // PNG: 8-byte signature, IHDR is always the first chunk.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === 'PNG' &&
    ascii(bytes, 12, 4) === 'IHDR'
  ) {
    return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  }

  // GIF87a / GIF89a: logical screen descriptor right after the signature.
  if (bytes.length >= 10 && ascii(bytes, 0, 4) === 'GIF8') {
    return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
  }

  // JPEG: walk segments until a start-of-frame marker.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xff) {
        i += 1; // fill byte
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2; // standalone marker, no length
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS before SOF
      const segLen = u16be(bytes, i + 2);
      if (segLen < 2) return null;
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        if (i + 8 >= bytes.length) return null;
        return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
      }
      i += 2 + segLen;
    }
    return null;
  }

  // WebP: RIFF container, dimensions depend on the first chunk variant.
  if (
    bytes.length >= 30 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8 ') {
      // Lossy: keyframe start code, then 14-bit dimensions.
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
        return null;
      }
      return {
        width: u16le(bytes, 26) & 0x3fff,
        height: u16le(bytes, 28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      if (bytes[20] !== 0x2f) return null;
      const bits = u32le(bytes, 21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X') {
      return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
    }
  }

  return null;
}

function altFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop() || '';
    return decodeURIComponent(name) || 'image';
  } catch {
    return 'image';
  }
}

/**
 * Classify a `--image` value and return the canonical https URL to fetch and
 * post. Throws the contract's fixed error for every rejected shape; no network
 * call is made on any rejection path.
 */
export function assertPostableImageUrl(raw: string): string {
  const classified = classifyMediaUrl(raw);
  switch (classified.kind) {
    case 'local':
      throw commandError(LOCAL_MEDIA_ERROR);
    case 'http':
      throw commandError(HTTPS_ONLY_ERROR);
    case 'userinfo':
      throw commandError(USERINFO_ERROR);
    case 'invalid':
      throw commandError(INVALID_MEDIA_ERROR);
    case 'https':
      return classified.canonical;
  }
}

export type ImageFetcher = (
  canonicalUrl: string
) => Promise<{ bytes: Uint8Array }>;

/** The `--image` guard budget, exported so tests lock the contract's limits. */
export const IMAGE_GUARD_OPTIONS = {
  maxBytes: MAX_IMAGE_BYTES,
  deadlineMs: IMAGE_FETCH_DEADLINE_MS,
  maxRedirects: 3,
  requireHttps: true,
} as const;

const guardedImageFetch: ImageFetcher = (canonicalUrl) =>
  fetchGuardedMedia(canonicalUrl, IMAGE_GUARD_OPTIONS);

/**
 * Fetch an image URL through the guard and build its story image block verse.
 * Throws with an actionable message when the URL is rejected by the contract
 * or when the bytes are not a direct raster image.
 */
export async function fetchImageVerse(
  url: string,
  fetchImage: ImageFetcher = guardedImageFetch
): Promise<StoryVerse> {
  const canonical = assertPostableImageUrl(url);
  const { bytes } = await fetchImage(canonical);
  const size = imageDimensions(bytes);
  if (!size || size.width <= 0 || size.height <= 0) {
    throw commandError(
      'Could not determine image dimensions — pass a direct raster image URL ' +
        '(png/jpeg/gif/webp), e.g. the URL returned by `tlon upload`.'
    );
  }
  return {
    block: {
      image: {
        src: canonical,
        width: size.width,
        height: size.height,
        alt: altFromUrl(canonical),
      },
    },
  };
}

/**
 * Return the index of an optional `--image <url>` or `--image=<url>` flag.
 */
export function imageFlagIndex(args: string[]): number {
  return args.findIndex(
    (arg) => arg === '--image' || arg.startsWith('--image=')
  );
}

/**
 * Return the value of an optional `--image <url>` or `--image=<url>` flag.
 * Throws a usage error when the flag is present but its value is missing.
 */
export function imageFlagValue(
  args: string[],
  usage: string
): string | undefined {
  const idx = imageFlagIndex(args);
  if (idx === -1) {
    return undefined;
  }

  const arg = args[idx];
  const url = arg.startsWith('--image=')
    ? arg.slice('--image='.length)
    : args[idx + 1];
  if (!url) {
    throw usageError(usage);
  }
  return url;
}

/**
 * Validate an optional image flag. Returns the canonical https URL when
 * present, undefined when absent; throws on a malformed flag or a URL the
 * outbound-media contract refuses. This is the single implementation — both
 * `posts send` and `dms send` use it, so their `--image` handling cannot drift.
 */
export function validatedImageFlag(
  args: string[],
  usage: string
): string | undefined {
  const url = imageFlagValue(args, usage);
  if (!url) {
    return undefined;
  }
  return assertPostableImageUrl(url);
}
