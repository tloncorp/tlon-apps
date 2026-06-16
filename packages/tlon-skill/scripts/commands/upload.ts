import {
  type CommandDeps,
  commandError,
  errorMessage,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

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

export interface UploadFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  blob: () => Promise<UploadBlobLike>;
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

export interface UploadDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  readStdin: () => Promise<Uint8Array>;
  fetch: (url: string) => Promise<UploadFetchResponse>;
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

async function uploadFromUrl(
  imageUrl: string,
  contentType: string | undefined,
  deps: UploadDeps
): Promise<string> {
  const url = parseUrl(imageUrl);

  let response: UploadFetchResponse;
  try {
    response = await deps.fetch(imageUrl);
  } catch (error) {
    throw commandError(`Failed to fetch: ${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw commandError(
      `Failed to fetch: ${response.status} ${response.statusText}`
    );
  }

  let blob: UploadBlobLike;
  try {
    blob = await response.blob();
  } catch (error) {
    throw commandError(`Failed to read response body: ${errorMessage(error)}`);
  }

  const ct = contentType || blob.type || mimeFromPath(imageUrl, deps);
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

    const uploadedUrl =
      parsed.kind === 'stdin'
        ? await uploadFromStdin(parsed.contentType, deps)
        : isUrl(parsed.input)
          ? await uploadFromUrl(parsed.input, parsed.contentType, deps)
          : await uploadFromFile(parsed.input, parsed.contentType, deps);

    writeLine(deps.stdout, uploadedUrl);
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
