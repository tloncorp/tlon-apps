import {
  uploadFile as apiUploadFile,
  getCurrentUserIsHosted,
  scry,
} from '@tloncorp/api';
import * as fs from 'fs';
import * as path from 'path';

import { ensureClient } from './api-client';
import {
  UPLOAD_GUARD_OPTIONS,
  type UploadBlobLike,
  type UploadDeps,
  type UploadPreflight,
  shipCanStoreUploads,
} from './commands/upload';
import { fetchGuardedMedia } from './media-guard';

const STDIN_TIMEOUT_MS = 30_000;

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

function bytesToBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    bytes.buffer as ArrayBuffer,
    bytes.byteOffset,
    bytes.byteLength
  );
}

async function readStdin(): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      process.stdin.destroy();
      reject(
        new Error(
          'stdin read timed out after 30s - did you forget to pipe input?'
        )
      );
    }, STDIN_TIMEOUT_MS);

    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    process.stdin.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function isTlonHostingForced(): boolean {
  const raw = (process.env.TLON_HOSTING ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function isHostedClient(): boolean {
  try {
    return isTlonHostingForced() || getCurrentUserIsHosted();
  } catch {
    return false;
  }
}

type StorageCredentialsScry = {
  'storage-update': {
    credentials: {
      accessKeyId?: string;
      endpoint?: string;
      secretAccessKey?: string;
    };
  };
};

type StorageConfigurationScry = {
  'storage-update': {
    configuration: { currentBucket?: string; service?: string };
  };
};

/**
 * Read the two storage scries and apply the routing predicate. Returns null
 * when the scries cannot be read, which the command treats as "unknown" and
 * proceeds — only a definitive "not capable" blocks an upload.
 */
async function canStoreUploads(): Promise<UploadPreflight | null> {
  try {
    const [rawCreds, rawConfig] = await Promise.all([
      scry<StorageCredentialsScry>({ app: 'storage', path: '/credentials' }),
      scry<StorageConfigurationScry>({
        app: 'storage',
        path: '/configuration',
      }),
    ]);
    const credentials = rawCreds['storage-update'].credentials;
    const configuration = rawConfig['storage-update'].configuration;
    if (
      shipCanStoreUploads({
        hosted: isHostedClient(),
        credentials,
        configuration,
      })
    ) {
      return { canStore: true };
    }
    const hasCustomS3 = Boolean(
      credentials?.accessKeyId &&
        credentials?.endpoint &&
        credentials?.secretAccessKey
    );
    return {
      canStore: false,
      // With credentials present, the only way the predicate says no is a
      // missing bucket; name that instead of misdiagnosing the storage setup.
      reason: hasCustomS3 ? 'no-bucket' : 'no-storage',
    };
  } catch {
    return null;
  }
}

export function createUploadDeps(): UploadDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      await ensureClient();
    },
    canStoreUploads,
    readStdin,
    fetchSource: async (canonicalUrl) => {
      const result = await fetchGuardedMedia(
        canonicalUrl,
        UPLOAD_GUARD_OPTIONS
      );
      return { bytes: result.bytes, contentType: result.contentType };
    },
    fileSystem: {
      resolvePath: (filePath) => path.resolve(filePath),
      exists: (filePath) => fs.existsSync(filePath),
      readFile: (filePath) => fs.readFileSync(filePath),
      basename: (filePath) => path.basename(filePath),
      extension: (filePath) => path.extname(filePath),
    },
    createBlob: (data, contentType): UploadBlobLike => {
      return new Blob([bytesToBlobPart(data)], { type: contentType });
    },
    uploadApi: {
      uploadFile: async ({ blob, contentType, fileName }) => {
        const result = await apiUploadFile({
          blob: blob as Blob,
          contentType,
          fileName,
          // Default to URL-based hosted detection. When the connection
          // reaches its node over localhost/proxy that heuristic fails, so an
          // operator sets TLON_HOSTING to force the hosted (memex) upload path.
          ...(isTlonHostingForced()
            ? { hostedDetection: 'assume-hosted' as const }
            : {}),
        });
        return { url: result.url };
      },
    },
  };
}
