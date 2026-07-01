import type { ClientPostBlobData } from '@tloncorp/api';
import { parsePostBlob } from '@tloncorp/api';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';

import { getDefaultSsrFPolicy } from '../urbit/context.js';

// Default to OpenClaw workspace media directory
const DEFAULT_MEDIA_DIR = path.join(
  homedir(),
  '.openclaw',
  'workspace',
  'media',
  'inbound'
);
export const MAX_BLOB_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export interface ExtractedImage {
  url: string;
  alt?: string;
}

export interface DownloadedMedia {
  localPath: string;
  contentType: string;
  originalUrl: string;
}

interface DownloadMediaOptions {
  maxBytes?: number;
  onTooLarge?: (info: {
    declaredSizeBytes?: number;
    observedSizeBytes?: number;
  }) => void;
}

export interface BlobAttachmentDownloadResult {
  attachments: Array<{ path: string; contentType: string }>;
  notices: string[];
}

type DownloadableBlobEntry = Extract<
  ClientPostBlobData[number],
  { type: 'file' | 'voicememo' | 'video' }
>;

class MediaTooLargeError extends Error {
  constructor(
    public readonly observedSizeBytes: number,
    public readonly maxBytes: number
  ) {
    super(`media exceeds ${maxBytes} byte limit`);
  }
}

/**
 * Extract image blocks from Tlon message content.
 * Returns array of image URLs found in the message.
 */
export function extractImageBlocks(content: unknown): ExtractedImage[] {
  if (!content || !Array.isArray(content)) {
    return [];
  }

  const images: ExtractedImage[] = [];

  for (const verse of content) {
    if (verse?.block?.image?.src) {
      images.push({
        url: verse.block.image.src,
        alt: verse.block.image.alt,
      });
    }
  }

  return images;
}

/**
 * Download a media file from URL to local storage.
 * Returns the local path where the file was saved.
 */
export async function downloadMedia(
  url: string,
  mediaDir: string = DEFAULT_MEDIA_DIR,
  options: DownloadMediaOptions = {}
): Promise<DownloadedMedia | null> {
  let localPath: string | null = null;

  try {
    // Validate URL is http/https before fetching
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      console.warn(`[tlon-media] Rejected non-http(s) URL: ${url}`);
      return null;
    }

    // Ensure media directory exists
    await mkdir(mediaDir, { recursive: true });

    // Fetch with SSRF protection
    // Use fetchWithSsrFGuard directly (not urbitFetch) to preserve the full URL path
    const { response, release } = await fetchWithSsrFGuard({
      url,
      init: { method: 'GET' },
      policy: getDefaultSsrFPolicy(),
      auditContext: 'tlon-media-download',
    });

    try {
      if (!response.ok) {
        console.error(
          `[tlon-media] Failed to fetch ${url}: ${response.status}`
        );
        return null;
      }

      // Determine content type and extension
      const contentType =
        response.headers.get('content-type') || 'application/octet-stream';
      const ext =
        getExtensionFromContentType(contentType) ||
        getExtensionFromUrl(url) ||
        'bin';

      const contentLength = response.headers.get('content-length');
      const declaredSizeBytes =
        contentLength && /^\d+$/.test(contentLength)
          ? Number.parseInt(contentLength, 10)
          : undefined;
      if (
        options.maxBytes !== undefined &&
        declaredSizeBytes !== undefined &&
        declaredSizeBytes > options.maxBytes
      ) {
        options.onTooLarge?.({ declaredSizeBytes });
        console.warn(
          `[tlon-media] Skipping ${url}: declared size ${declaredSizeBytes} exceeds ${options.maxBytes} byte limit`
        );
        return null;
      }

      // Generate unique filename
      const filename = `${randomUUID()}.${ext}`;
      localPath = path.join(mediaDir, filename);

      // Stream to file
      const body = response.body;
      if (!body) {
        console.error(`[tlon-media] No response body for ${url}`);
        return null;
      }

      const writeStream = createWriteStream(localPath);
      let observedSizeBytes = 0;
      const limitTransform =
        options.maxBytes === undefined
          ? undefined
          : new Transform({
              transform(chunk, _encoding, callback) {
                observedSizeBytes += Buffer.byteLength(chunk);
                if (observedSizeBytes > options.maxBytes!) {
                  callback(
                    new MediaTooLargeError(observedSizeBytes, options.maxBytes!)
                  );
                  return;
                }
                callback(null, chunk);
              },
            });

      await pipeline(
        Readable.fromWeb(body as any),
        ...(limitTransform ? [limitTransform] : []),
        writeStream
      );

      return {
        localPath,
        contentType,
        originalUrl: url,
      };
    } finally {
      await release();
    }
  } catch (error: unknown) {
    if (localPath) {
      await unlink(localPath).catch(() => undefined);
    }

    if (error instanceof MediaTooLargeError) {
      options.onTooLarge?.({ observedSizeBytes: error.observedSizeBytes });
      console.warn(
        `[tlon-media] Skipping ${url}: streamed size ${error.observedSizeBytes} exceeds ${error.maxBytes} byte limit`
      );
      return null;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[tlon-media] Error downloading ${url}: ${message}`);
    return null;
  }
}

function getExtensionFromContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-m4a': 'm4a',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'text/plain': 'txt',
  };
  return map[contentType.split(';')[0].trim()] ?? null;
}

function getExtensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Download all images from a message and return attachment metadata.
 * Format matches OpenClaw's expected attachment structure.
 */
export async function downloadMessageImages(
  content: unknown,
  mediaDir?: string
): Promise<Array<{ path: string; contentType: string }>> {
  const images = extractImageBlocks(content);
  if (images.length === 0) {
    return [];
  }

  const attachments: Array<{ path: string; contentType: string }> = [];

  for (const image of images) {
    const downloaded = await downloadMedia(image.url, mediaDir);
    if (downloaded) {
      attachments.push({
        path: downloaded.localPath,
        contentType: downloaded.contentType,
      });
    }
  }

  return attachments;
}

/**
 * Parse a post's blob field into structured blob data.
 * Returns null if blob is empty/missing, otherwise mirrors the API parser's
 * graceful degradation behavior for malformed entries.
 */
export function parseBlobData(
  blob: string | null | undefined
): ClientPostBlobData | null {
  if (!blob) {
    return null;
  }
  try {
    const parsed = parsePostBlob(blob);
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Format blob data as text annotations for the agent.
 * Returns a string like:
 *   📎 [report.pdf] (application/pdf, 245KB) https://storage.example.com/report.pdf
 *   🎙️ [voice memo] (12s) "Hey, check this out"
 *   🎬 [clip.mp4] (video/mp4, 1.2MB)
 */
type BlobFormatMode = 'annotation' | 'history';

function formatBlobEntry(
  entry: ClientPostBlobData[number],
  mode: BlobFormatMode
): string[] {
  if (entry.type === 'file') {
    const name = entry.name || 'file';
    if (mode === 'history') {
      return [`[📎 ${name}]`];
    }
    const mime = entry.mimeType || 'unknown';
    const size = entry.size ? formatFileSize(entry.size) : '?';
    let line = `📎 [${name}] (${mime}, ${size})`;
    if (entry.fileUri) {
      line += ` ${entry.fileUri}`;
    }
    return [line];
  }

  if (entry.type === 'voicememo') {
    if (mode === 'history') {
      if (entry.transcription) {
        return [`[🎙️ voice memo: "${entry.transcription}"]`];
      }
      const dur = entry.duration ? `${Math.round(entry.duration)}s` : '';
      return [`[🎙️ voice memo${dur ? `, ${dur}` : ''}]`];
    }

    const dur = entry.duration ? `${Math.round(entry.duration)}s` : '?';
    let line = `🎙️ [voice memo] (${dur})`;
    if (entry.fileUri) {
      line += ` ${entry.fileUri}`;
    }
    const lines = [line];
    if (entry.transcription) {
      lines.push(`  "${entry.transcription}"`);
    }
    return lines;
  }

  if (entry.type === 'video') {
    const name = entry.name || 'video';
    if (mode === 'history') {
      return [`[🎬 ${name}]`];
    }
    const mime = entry.mimeType || 'video';
    const size = entry.size ? formatFileSize(entry.size) : '?';
    let line = `🎬 [${name}] (${mime}, ${size})`;
    if (entry.fileUri) {
      line += ` ${entry.fileUri}`;
    }
    return [line];
  }

  return [];
}

export function formatBlobAnnotations(blobData: ClientPostBlobData): string {
  const lines: string[] = [];

  for (const entry of blobData) {
    lines.push(...formatBlobEntry(entry, 'annotation'));
  }

  return lines.join('\n');
}

/**
 * Compact blob annotation for history/context display.
 * Omits URIs and sizes; surfaces voice memo transcripts prominently.
 */
export function formatBlobForHistory(blobData: ClientPostBlobData): string {
  const lines: string[] = [];

  for (const entry of blobData) {
    lines.push(...formatBlobEntry(entry, 'history'));
  }

  return lines.join('\n');
}

/**
 * Download all downloadable blob attachments (files, voice memos, videos)
 * and return attachment metadata for OpenClaw.
 */
export async function downloadBlobAttachments(
  blobData: ClientPostBlobData,
  mediaDir?: string
): Promise<BlobAttachmentDownloadResult> {
  const attachments: Array<{ path: string; contentType: string }> = [];
  const notices: string[] = [];

  for (const entry of blobData) {
    if (!isDownloadableBlobEntry(entry)) {
      continue;
    }

    // non-media entries (e.g. a tlon-context-lens bot-run reference) aren't in
    // the downloadable allowlist above, so they're already skipped here.
    const uri = entry.fileUri;
    if (!uri) {
      continue;
    }

    // Only download http/https URIs
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
    } catch {
      continue;
    }

    const declaredSize = 'size' in entry ? entry.size : undefined;
    if (declaredSize !== undefined && declaredSize > MAX_BLOB_DOWNLOAD_BYTES) {
      notices.push(formatBlobTooLargeNotice(entry, declaredSize));
      continue;
    }

    const downloaded = await downloadMedia(uri, mediaDir, {
      maxBytes: MAX_BLOB_DOWNLOAD_BYTES,
      onTooLarge: ({ declaredSizeBytes, observedSizeBytes }) => {
        notices.push(
          formatBlobTooLargeNotice(
            entry,
            declaredSizeBytes ?? observedSizeBytes
          )
        );
      },
    });
    if (downloaded) {
      attachments.push({
        path: downloaded.localPath,
        contentType: downloaded.contentType,
      });
    }
  }

  return { attachments, notices };
}

function formatBlobTooLargeNotice(
  entry: DownloadableBlobEntry,
  sizeBytes?: number
): string {
  const name = 'name' in entry ? entry.name : undefined;
  const label =
    entry.type === 'voicememo' ? 'voice memo' : name || 'blob attachment';
  const sizeText =
    sizeBytes !== undefined ? formatFileSize(sizeBytes) : 'unknown size';
  return `[blob not downloaded: ${label} is ${sizeText}, over the ${formatFileSize(MAX_BLOB_DOWNLOAD_BYTES)} limit]`;
}

function isDownloadableBlobEntry(
  entry: ClientPostBlobData[number]
): entry is DownloadableBlobEntry {
  return (
    entry.type === 'file' ||
    entry.type === 'voicememo' ||
    entry.type === 'video'
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
