import {
  USERINFO_ERROR,
  classifyMediaUrl,
  strictPostableUrl,
} from '../media-guard';
import {
  type CommandDeps,
  CommandError,
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';
import { MIME_TYPES } from '../mime-types';

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

export const INVALID_UPLOAD_URL_ERROR = 'Invalid URL.';
export const UPLOAD_FILE_NOT_FOUND_ERROR = 'File not found.';
export const BATCH_ITEM_UNEXPECTED_ERROR =
  'Upload failed — run `tlon upload` on this input alone for details.';

export const UPLOAD_HELP = `Usage: tlon upload <url-or-path> [<url-or-path>...] [options]
       tlon upload --stdin [-t mime/type]

Upload files to Tlon storage from URLs, local paths, or stdin.
One input: outputs the uploaded URL on success.
Several inputs: uploads them one at a time, in order, and prints one line per
input, identified by its position: "input N: <uploaded-url>" on success or
"input N: <error>" on failure. Exits 0 when at least one input uploaded
(failures are then reported on stdout alongside the successes); exits 1 with
the errors on stderr only when every input failed. A remote source fetch is
limited to 100 MiB and 120 seconds per URL. The tlon tool's command timeout
covers the whole batch and a timed-out run loses its results — split large
batches into several uploads.

Options:
  --stdin         Shell CLI only: read piped data (single input); unavailable through the tlon tool
  -t, --type      Override content type for every input (e.g., image/png,
                  application/pdf); for different types, upload separately
  -h, --help      Show this help

Examples:
  tlon upload https://example.com/image.png
  tlon upload ./photo.jpg
  tlon upload ./one.jpg ./two.png https://example.com/three.gif
  tlon upload ~/Pictures/screenshot.png
  tlon upload ./mystery-file -t image/webp
  cat image.png | tlon upload --stdin -t image/png
  curl -s https://example.com/img.jpg | tlon upload --stdin -t image/jpeg`;

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
  | { kind: 'inputs'; inputs: string[]; contentType?: string };

/**
 * A validation error whose message names the user's local path. Single-input
 * runs print `message` as before; batch output identifies items by position
 * only, so it prints the input-free `fixedMessage` instead.
 */
class UploadInputError extends CommandError {
  readonly fixedMessage: string;

  constructor(message: string, fixedMessage: string) {
    super(message);
    this.name = 'UploadInputError';
    this.fixedMessage = fixedMessage;
  }
}

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
    // Never echo a URL: userinfo, a signed query, a fragment or the path
    // itself can carry a secret.
    throw commandError(INVALID_UPLOAD_URL_ERROR);
  }
}

/**
 * Tokens that could be an input: everything but `--stdin`, `-t`/`--type` and
 * its value, and help flags.
 */
function inputLikeTokenCount(args: string[]): number {
  let count = 0;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--stdin' || isHelpArg(arg)) continue;
    if (arg === '-t' || arg === '--type') {
      i += 1;
      continue;
    }
    count += 1;
  }
  return count;
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
      // With several input-like tokens this may be an input (a file named
      // `-x.png`), so identify it by position rather than echo it.
      throw usageError(
        inputLikeTokenCount(args) > 1
          ? `Unknown option (argument ${i + 1}).`
          : `Unknown option: ${arg}`,
        UPLOAD_HELP
      );
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

  return { kind: 'inputs', inputs: positional, contentType };
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
  throw commandError(INVALID_UPLOAD_URL_ERROR);
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
    throw new UploadInputError(
      `File not found: ${resolved}`,
      UPLOAD_FILE_NOT_FOUND_ERROR
    );
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

/**
 * Neither backend validates its own return path (Memex returns `filePath`
 * as-is; custom S3 derives from `publicUrlBase`), so an http or
 * credential-bearing URL could be printed and then rejected downstream by
 * `--image`. Fail here instead.
 */
function postableOrThrow(uploadedUrl: string): string {
  const postable = strictPostableUrl(uploadedUrl);
  if (!postable) {
    throw commandError(UNPOSTABLE_UPLOAD_URL_ERROR);
  }
  return postable;
}

async function uploadInput(
  input: string,
  contentType: string | undefined,
  deps: UploadDeps
): Promise<string> {
  const uploadedUrl = isUrl(input)
    ? await uploadFromUrl(input, contentType, deps)
    : await uploadFromFile(input, contentType, deps);
  return postableOrThrow(uploadedUrl);
}

/** A batch item's failure text: never the input, only fixed messages. */
function batchItemError(error: unknown): string {
  if (error instanceof UploadInputError) return error.fixedMessage;
  if (error instanceof CommandError) return error.message;
  // Unexpected errors (filesystem, storage client) can quote the path or URL.
  return BATCH_ITEM_UNEXPECTED_ERROR;
}

/**
 * Uploads every input in order. The tlon tool surfaces only stderr when a
 * command exits nonzero, so any success makes the batch exit 0 with every
 * line on stdout; failure lines are held back until the first success (or
 * until every input has failed, when they go to stderr with exit 1).
 */
async function uploadBatch(
  inputs: string[],
  contentType: string | undefined,
  deps: UploadDeps
): Promise<number> {
  const heldFailures: string[] = [];
  let succeeded = false;

  for (const [index, input] of inputs.entries()) {
    const label = `input ${index + 1}`;
    try {
      const postable = await uploadInput(input, contentType, deps);
      if (!succeeded) {
        succeeded = true;
        for (const line of heldFailures) writeLine(deps.stdout, line);
        heldFailures.length = 0;
      }
      writeLine(deps.stdout, `${label}: ${postable}`);
    } catch (error) {
      const line = `${label}: ${batchItemError(error)}`;
      if (succeeded) {
        writeLine(deps.stdout, line);
      } else {
        heldFailures.push(line);
      }
    }
  }

  if (succeeded) return 0;
  for (const line of heldFailures) writeLine(deps.stderr, line);
  return 1;
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

    if (parsed.kind === 'inputs' && parsed.inputs.length > 1) {
      return await uploadBatch(parsed.inputs, parsed.contentType, deps);
    }

    const postable =
      parsed.kind === 'stdin'
        ? postableOrThrow(await uploadFromStdin(parsed.contentType, deps))
        : await uploadInput(parsed.inputs[0], parsed.contentType, deps);

    writeLine(deps.stdout, postable);
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
