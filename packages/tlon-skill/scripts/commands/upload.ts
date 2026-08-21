import {
  USERINFO_ERROR,
  classifyMediaUrl,
  strictPostableUrl,
} from '../media-guard';
import {
  type CommandDeps,
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * `tlon upload` is a general file uploader (video, audio, PDF, archives), not
 * just the image flow, so it does not inherit the `--image` media budget. These
 * limits mirror the adapter's inbound blob ceiling and also fix today's
 * unbounded buffering of a remote response.
 */
export const UPLOAD_FETCH_DEADLINE_MS = 120_000;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** The `upload <url>` guard budget, exported so tests lock the limits. */
export const UPLOAD_GUARD_OPTIONS = {
  maxBytes: MAX_UPLOAD_BYTES,
  deadlineMs: UPLOAD_FETCH_DEADLINE_MS,
  maxRedirects: 3,
  // The source URL is never posted — the postable output is the storage URL —
  // so plain http sources stay allowed here (unlike `--image`).
  requireHttps: false,
} as const;

export const CANNOT_STORE_UPLOADS_ERROR =
  'This ship cannot store uploads (no custom S3 credentials and not a ' +
  'Tlon-hosted node). Pass a direct https image URL to `posts send --image` ' +
  'instead, or configure storage (or set TLON_HOSTING on hosted deployments).';

export const NO_BUCKET_SELECTED_ERROR =
  'This ship has custom S3 credentials but no storage bucket selected — ' +
  'choose a bucket in storage settings. For images you can instead pass a ' +
  'direct https image URL to `posts send --image`.';

export const UNPOSTABLE_UPLOAD_URL_ERROR =
  'Storage accepted the upload but returned a URL that cannot be posted — it ' +
  'must be a credential-free https URL. Check the storage configuration; a ' +
  'non-https `publicUrlBase` is the usual cause.';

export const UPLOAD_HELP = `Usage: tlon upload <url-or-path> [options]
       tlon upload --stdin [-t mime/type]

Upload a file to Tlon storage from a URL, local path, or stdin.
Outputs the uploaded URL on success.

Options:
  --stdin         Read binary data from stdin instead of a file/URL
  -t, --type      Override content type (e.g., image/png, application/pdf)
  -h, --help      Show this help

Examples:
  tlon upload https://example.com/image.png
  tlon upload ./photo.jpg
  tlon upload ~/Pictures/screenshot.png
  tlon upload ./mystery-file -t image/webp
  cat image.png | tlon upload --stdin -t image/png
  curl -s https://example.com/img.jpg | tlon upload --stdin -t image/jpeg`;

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
};

export interface UploadBlobLike {
  type?: string;
  size?: number;
}

export interface UploadSourceBytes {
  bytes: Uint8Array;
  contentType?: string;
}

export interface StorageCredentials {
  accessKeyId?: string;
  endpoint?: string;
  secretAccessKey?: string;
}

export interface StorageConfiguration {
  service?: string;
  currentBucket?: string;
}

/**
 * Whether `uploadFile` could actually store bytes for this ship.
 *
 * Exact mirror of `@tloncorp/api`'s own backend routing (`storageApi.ts`):
 * Memex when the client is a hosted node and either the service is
 * `presigned-url` or custom S3 credentials are absent; otherwise custom S3
 * credentials plus a current bucket for the S3 operation itself.
 */
export function shipCanStoreUploads(input: {
  hosted: boolean;
  credentials?: StorageCredentials | null;
  configuration?: StorageConfiguration | null;
}): boolean {
  const credentials = input.credentials ?? {};
  const configuration = input.configuration ?? {};
  const hasCustomS3 = Boolean(
    credentials.accessKeyId &&
    credentials.endpoint &&
    credentials.secretAccessKey
  );

  if (
    input.hosted &&
    (configuration.service === 'presigned-url' || !hasCustomS3)
  ) {
    return true;
  }

  return hasCustomS3 && Boolean(configuration.currentBucket);
}

export interface UploadFileSystem {
  resolvePath: (filePath: string) => string;
  exists: (filePath: string) => boolean;
  readFile: (filePath: string) => Uint8Array;
  basename: (filePath: string) => string;
  extension: (filePath: string) => string;
}

export interface UploadApi {
  uploadFile: (input: {
    blob: UploadBlobLike;
    contentType: string;
    fileName?: string;
  }) => Promise<{ url: string }>;
}

/**
 * Pre-flight outcome. A definitive "cannot store" carries the reason so the
 * fixed error names the operator's actual problem (a missing bucket is fixed
 * in storage settings; missing storage is a different situation entirely).
 */
export type UploadPreflight =
  | { canStore: true }
  | { canStore: false; reason: 'no-bucket' | 'no-storage' };

export interface UploadDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  /**
   * Pre-flight capability check. `null` means the storage scries could not be
   * read — the check is skipped in that case so `uploadFile`'s own error stays
   * authoritative and a transient scry failure never becomes a false
   * "cannot store".
   */
  canStoreUploads: () => Promise<UploadPreflight | null>;
  readStdin: () => Promise<Uint8Array>;
  fetchSource: (canonicalUrl: string) => Promise<UploadSourceBytes>;
  fileSystem: UploadFileSystem;
  createBlob: (data: Uint8Array, contentType: string) => UploadBlobLike;
  uploadApi: UploadApi;
}

type ParsedUploadArgs =
  | { kind: 'help' }
  | { kind: 'stdin'; contentType: string }
  | { kind: 'input'; input: string; contentType?: string };

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function mimeFromPath(filePath: string, deps: UploadDeps): string {
  const ext = deps.fileSystem.extension(filePath).toLowerCase();
  return MIME_TYPES[ext] || DEFAULT_CONTENT_TYPE;
}

function parseUrl(input: string): URL {
  try {
    return new URL(input);
  } catch {
    throw commandError(`Invalid URL: ${input}`);
  }
}

function parseArgs(args: string[]): ParsedUploadArgs {
  let stdinMode = false;
  let contentType: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--stdin') {
      stdinMode = true;
      continue;
    }

    if (arg === '-t' || arg === '--type') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        throw usageError(`${arg} requires a value`, UPLOAD_HELP);
      }
      contentType = value;
      i += 1;
      continue;
    }

    if (isHelpArg(arg)) {
      return { kind: 'help' };
    }

    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, UPLOAD_HELP);
    }

    positional.push(arg);
  }

  if (stdinMode) {
    if (positional.length > 0) {
      throw usageError(
        '--stdin cannot be combined with a file or URL',
        UPLOAD_HELP
      );
    }
    return { kind: 'stdin', contentType: contentType || DEFAULT_CONTENT_TYPE };
  }

  if (positional.length === 0) {
    throw usageError(UPLOAD_HELP);
  }

  if (positional.length > 1) {
    throw usageError(`Unexpected argument: ${positional[1]}`, UPLOAD_HELP);
  }

  return { kind: 'input', input: positional[0], contentType };
}

/**
 * Canonical form of a remote upload source. Embedded credentials are refused
 * (they would be sent to a third party and can leak through logs); plain http
 * stays allowed because the source URL is never posted.
 */
function canonicalUploadSource(input: string): string {
  const classified = classifyMediaUrl(input);
  if (classified.kind === 'userinfo') {
    throw commandError(USERINFO_ERROR);
  }
  if (classified.kind === 'https') {
    return classified.canonical;
  }
  if (classified.kind === 'http') {
    const parsed = parseUrl(input);
    if (
      parsed.username ||
      parsed.password ||
      /^http:\/\/[^/?#\\]*@/i.test(input.trim())
    ) {
      throw commandError(USERINFO_ERROR);
    }
    return parsed.href;
  }
  throw commandError(`Invalid URL: ${input}`);
}

/** Media type without parameters (`image/png; charset=x` → `image/png`). */
function mediaTypeOnly(header: string | undefined): string | undefined {
  const value = (header ?? '').split(';')[0].trim().toLowerCase();
  return value || undefined;
}

async function uploadFromUrl(
  sourceUrl: string,
  contentType: string | undefined,
  deps: UploadDeps
): Promise<string> {
  const canonical = canonicalUploadSource(sourceUrl);
  const url = parseUrl(canonical);

  const source = await deps.fetchSource(canonical);

  const ct =
    contentType ||
    mediaTypeOnly(source.contentType) ||
    mimeFromPath(canonical, deps);
  const blob = deps.createBlob(source.bytes, ct);
  const fileName = deps.fileSystem.basename(url.pathname);
  const uploadInput = fileName
    ? { blob, contentType: ct, fileName }
    : { blob, contentType: ct };
  const result = await deps.uploadApi.uploadFile(uploadInput);
  return result.url;
}

async function uploadFromFile(
  filePath: string,
  contentType: string | undefined,
  deps: UploadDeps
): Promise<string> {
  const resolved = deps.fileSystem.resolvePath(filePath);
  if (!deps.fileSystem.exists(resolved)) {
    throw commandError(`File not found: ${resolved}`);
  }

  const data = deps.fileSystem.readFile(resolved);
  const ct = contentType || mimeFromPath(resolved, deps);
  const blob = deps.createBlob(data, ct);
  const fileName = deps.fileSystem.basename(resolved);
  const result = await deps.uploadApi.uploadFile({
    blob,
    contentType: ct,
    fileName,
  });
  return result.url;
}

async function uploadFromStdin(
  contentType: string,
  deps: UploadDeps
): Promise<string> {
  const data = await deps.readStdin();
  if (data.byteLength === 0) {
    throw commandError('No data received on stdin');
  }

  const blob = deps.createBlob(data, contentType);
  const result = await deps.uploadApi.uploadFile({ blob, contentType });
  return result.url;
}

export async function run(args: string[], deps: UploadDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, UPLOAD_HELP);
    }

    await deps.authenticate();

    // Pre-flight before any bytes are read or fetched: a ship that cannot
    // store uploads should fail instantly and instructively rather than
    // downloading a file and dying on a cryptic storage error.
    const preflight = await deps.canStoreUploads();
    if (preflight && !preflight.canStore) {
      throw commandError(
        preflight.reason === 'no-bucket'
          ? NO_BUCKET_SELECTED_ERROR
          : CANNOT_STORE_UPLOADS_ERROR
      );
    }

    const uploadedUrl =
      parsed.kind === 'stdin'
        ? await uploadFromStdin(parsed.contentType, deps)
        : isUrl(parsed.input)
          ? await uploadFromUrl(parsed.input, parsed.contentType, deps)
          : await uploadFromFile(parsed.input, parsed.contentType, deps);

    // Neither backend validates its own return path (Memex returns `filePath`
    // as-is; custom S3 derives from `publicUrlBase`), so an http or
    // credential-bearing URL could be printed and then rejected downstream by
    // `--image`. Fail here instead.
    const postable = strictPostableUrl(uploadedUrl);
    if (!postable) {
      throw commandError(UNPOSTABLE_UPLOAD_URL_ERROR);
    }

    writeLine(deps.stdout, postable);
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
