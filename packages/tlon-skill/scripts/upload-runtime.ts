import { uploadFile as apiUploadFile } from '@tloncorp/api';
import * as fs from 'fs';
import * as path from 'path';

import { ensureClient } from './api-client';
import type { UploadBlobLike, UploadDeps } from './commands/upload';

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

export function createUploadDeps(): UploadDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      await ensureClient();
    },
    readStdin,
    fetch: (url) => fetch(url),
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
        });
        return { url: result.url };
      },
    },
  };
}
