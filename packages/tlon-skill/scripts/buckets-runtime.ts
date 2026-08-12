import {
  type BucketsEntry,
  type BucketsFileEntry,
  type BucketsFlag,
  type BucketsSnapshot,
  getBuckets,
  sendBucketsAction,
} from '@tloncorp/api';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ensureClient } from './api-client';
import type {
  BucketTarget,
  BucketsDeps,
  BucketsOperations,
} from './commands/buckets';
import { commandError, errorMessage } from './commands/command';

const DEFAULT_BROKER_URL = 'https://memex.tlon.network/v2/buckets';
const CAPABILITY_ATTEMPTS = 40;
const STATE_ATTEMPTS = 40;
const POLL_DELAY_MS = 250;
const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.avif': 'image/avif',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
};

type BrokerErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
};

type BucketUploadGrant = {
  reservationId: string;
  objectId: string;
  uploadUrl: string;
  requiredHeaders: [string, string][];
};

type BucketReadGrant = {
  objectId: string;
  readUrl: string;
};

class BucketsBrokerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'BucketsBrokerError';
  }
}

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

function brokerBaseUrl() {
  return (process.env.BUCKETS_BROKER_URL || DEFAULT_BROKER_URL).replace(
    /\/$/,
    ''
  );
}

function hostName(host: string) {
  return host.replace(/^~/, '');
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(attempt: number) {
  return Math.min(POLL_DELAY_MS * 2 ** Math.min(attempt, 2), 1_000);
}

function normalizeHost(host: string) {
  const normalized = host.toLowerCase();
  return normalized.startsWith('~') ? normalized : `~${normalized}`;
}

function flagsMatch(left: BucketsFlag, right: BucketsFlag) {
  return (
    normalizeHost(left.host) === normalizeHost(right.host) &&
    left.name === right.name
  );
}

function bucketNest(flag: BucketsFlag) {
  return `buckets/${normalizeHost(flag.host)}/${flag.name}`;
}

function serializeSnapshot(snapshot: BucketsSnapshot) {
  return {
    nest: bucketNest(snapshot.flag),
    title: snapshot.state.bucket.title,
    group: `${normalizeHost(snapshot.state.group.host)}/${snapshot.state.group.name}`,
    readers: snapshot.state.readers,
    writers: snapshot.state.writers,
    revision: snapshot.state.revision,
    entries: snapshot.state.entries.length,
  };
}

function serializeEntry(entry: BucketsEntry) {
  return entry.kind === 'folder'
    ? {
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        parentId: entry.parentId,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
      }
    : {
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        parentId: entry.parentId,
        mime: entry.file.mime,
        size: entry.file.size,
        status: entry.file.status,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
      };
}

async function getSnapshot(target: BucketTarget): Promise<BucketsSnapshot> {
  const snapshot = (await getBuckets()).find((candidate) =>
    flagsMatch(candidate.flag, target.flag)
  );
  if (!snapshot) {
    throw commandError(
      `Bucket ${target.nest} was not found or is not readable`
    );
  }
  return snapshot;
}

function requireEntry(snapshot: BucketsSnapshot, id: number) {
  const entry = snapshot.state.entries.find((candidate) => candidate.id === id);
  if (!entry) throw commandError(`Entry ${id} was not found`);
  return entry;
}

function requireReadyFile(snapshot: BucketsSnapshot, id: number) {
  const entry = requireEntry(snapshot, id);
  if (entry.kind !== 'file') throw commandError(`Entry ${id} is a folder`);
  if (entry.file.status !== 'ready') {
    throw commandError(`File ${id} is not ready`);
  }
  return entry;
}

function createCapability() {
  return randomBytes(32).toString('hex');
}

function defaultBucketName() {
  return `bucket-${randomBytes(6).toString('hex').slice(0, 10)}`;
}

function validateBucketName(name: string) {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(name)) {
    throw commandError(
      'Bucket name must start with a lowercase letter and contain only lowercase letters, numbers, or hyphens'
    );
  }
  return name;
}

function validateDisplayName(name: string, label: string) {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    /[/\\]/.test(trimmed)
  ) {
    throw commandError(`${label} must be a non-empty name without slashes`);
  }
  return trimmed;
}

async function brokerRequest<T>(
  relativePath: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${brokerBaseUrl()}${relativePath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as BrokerErrorBody | null;
    throw new BucketsBrokerError(
      body?.message ??
        (response.status === 404
          ? 'The private Buckets broker is not deployed on this host. Bot uploads require the private broker and cannot fall back to owner storage credentials.'
          : `Buckets storage returned ${response.status}`),
      response.status,
      body?.code,
      body?.retryable ?? false
    );
  }
  return (await response.json()) as T;
}

function grantUpload(capability: string, host: string) {
  return brokerRequest<BucketUploadGrant>('/uploads/grant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${capability}` },
    body: JSON.stringify({ host: hostName(host) }),
  });
}

function completeUpload(reservationId: string) {
  return brokerRequest<unknown>(
    `/uploads/${encodeURIComponent(reservationId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ reservationId }),
    }
  );
}

function grantRead(capability: string, host: string, objectId: string) {
  return brokerRequest<BucketReadGrant>(
    `/objects/${encodeURIComponent(objectId)}/read-grant`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${capability}` },
      body: JSON.stringify({ host: hostName(host) }),
    }
  );
}

async function waitForCapability<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < CAPABILITY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof BucketsBrokerError &&
        (error.retryable ||
          (error.status === 403 && error.code === 'capability_denied'));
      if (!retryable) {
        throw error;
      }
      if (attempt + 1 < CAPABILITY_ATTEMPTS) {
        await delay(retryDelay(attempt));
      }
    }
  }
  throw lastError;
}

async function waitForBucketUpdate<T>(
  target: BucketTarget,
  priorRevision: number,
  operation: string,
  select: (snapshot: BucketsSnapshot) => T | undefined
): Promise<T> {
  for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
    const snapshot = await getSnapshot(target);
    if (snapshot.state.revision > priorRevision) {
      const selected = select(snapshot);
      if (selected !== undefined) return selected;
    }
    await delay(POLL_DELAY_MS);
  }
  throw commandError(`The Bucket host did not confirm ${operation} in time`);
}

function sameStrings(left: string[], right: string[]) {
  const normalize = (values: string[]) => [...new Set(values)].sort();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

async function waitForUploadSession(
  target: BucketTarget,
  priorSessionIds: Set<string>,
  objectId: string,
  parentId: number | null,
  name: string
) {
  for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
    const snapshot = await getSnapshot(target);
    const entry = snapshot.state.entries.find(
      (candidate): candidate is BucketsFileEntry =>
        candidate.kind === 'file' &&
        candidate.file.objectKey === objectId &&
        candidate.parentId === parentId &&
        candidate.name === name &&
        snapshot.state.sessions.some(
          (session) =>
            session.fileId === candidate.id && !priorSessionIds.has(session.id)
        )
    );
    const session = snapshot.state.sessions.find(
      (candidate) =>
        candidate.fileId === entry?.id && !priorSessionIds.has(candidate.id)
    );
    if (entry && session) return { entry, session };
    await delay(POLL_DELAY_MS);
  }
  throw commandError('The Bucket host did not start the upload in time');
}

async function readBoundedText(response: Response, fileId: number) {
  if (!response.body) {
    throw commandError(`File ${fileId} returned an empty response body`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_TEXT_READ_BYTES) {
        await reader.cancel();
        throw commandError(
          `File ${fileId} exceeded the ${MAX_TEXT_READ_BYTES}-byte text read limit`
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function waitForReadyFile(target: BucketTarget, id: number) {
  for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
    const snapshot = await getSnapshot(target);
    const entry = snapshot.state.entries.find(
      (candidate): candidate is BucketsFileEntry =>
        candidate.kind === 'file' && candidate.id === id
    );
    if (entry?.file.status === 'ready') return entry;
    if (entry?.file.status === 'failed') {
      throw commandError(`The Bucket host marked file ${id} failed`);
    }
    await delay(POLL_DELAY_MS);
  }
  throw commandError('The Bucket host did not finish the upload in time');
}

function mimeFromPath(filePath: string) {
  return (
    MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ||
    'application/octet-stream'
  );
}

function fileUploadBody(filePath: string): Blob {
  const runtime = globalThis as typeof globalThis & {
    Bun?: { file(path: string): Blob };
  };
  if (!runtime.Bun) {
    throw commandError('Bucket uploads require the Bun-based tlon binary');
  }
  return runtime.Bun.file(filePath);
}

function pathForEntry(entry: BucketsEntry, entries: BucketsEntry[]) {
  const names = [entry.name];
  let parentId = entry.parentId;
  const visited = new Set<number>();
  while (parentId !== null && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = entries.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join('/');
}

function isTextMime(mime: string) {
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/xml' ||
    mime.endsWith('+json') ||
    mime.endsWith('+xml')
  );
}

async function privateReadUrl(target: BucketTarget, entry: BucketsFileEntry) {
  if (entry.file.objectUrl) {
    throw commandError(
      `File ${entry.id} uses a legacy external object URL. Bot reads require broker-managed Bucket storage.`
    );
  }
  const capability = createCapability();
  await sendBucketsAction({
    type: 'issue-read',
    capability,
    flag: target.flag,
    id: entry.id,
  });
  const grant = await waitForCapability(() =>
    grantRead(capability, target.flag.host, entry.file.objectKey)
  );
  return grant.readUrl;
}

function createBucketsOperations(): BucketsOperations {
  return {
    async list() {
      return (await getBuckets()).map(serializeSnapshot);
    },

    async show(target) {
      return getSnapshot(target);
    },

    async files(target, parentId) {
      const snapshot = await getSnapshot(target);
      return snapshot.state.entries
        .filter((entry) => entry.parentId === parentId)
        .sort((left, right) => {
          if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
          return left.name.localeCompare(right.name);
        })
        .map(serializeEntry) as unknown as BucketsEntry[];
    },

    async search(target, query) {
      const snapshot = await getSnapshot(target);
      const normalized = query.trim().toLowerCase();
      if (!normalized) return [];
      return snapshot.state.entries
        .filter((entry) => {
          const fileMetadata =
            entry.kind === 'file'
              ? `${entry.file.mime} ${entry.file.status}`
              : '';
          return `${entry.name} ${entry.createdBy} ${entry.updatedBy} ${fileMetadata}`
            .toLowerCase()
            .includes(normalized);
        })
        .map((entry) => ({
          ...serializeEntry(entry),
          path: pathForEntry(entry, snapshot.state.entries),
        }));
    },

    async create({ group, title, name }) {
      const bucketName = validateBucketName(name ?? defaultBucketName());
      const bucketTitle = title.trim();
      const normalizedGroup = {
        host: normalizeHost(group.host),
        name: group.name,
      };
      const flag = { host: normalizedGroup.host, name: bucketName };
      const nest = bucketNest(flag);
      const existing = (await getBuckets()).find((snapshot) =>
        flagsMatch(snapshot.flag, flag)
      );
      if (existing) {
        throw commandError(`Bucket ${nest} already exists`);
      }
      await sendBucketsAction({
        type: 'create',
        group: normalizedGroup,
        name: bucketName,
        readers: [],
        title: bucketTitle,
        writers: [],
      });
      for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
        const found = (await getBuckets()).find(
          (snapshot) =>
            flagsMatch(snapshot.flag, flag) &&
            flagsMatch(snapshot.state.group, normalizedGroup) &&
            snapshot.state.bucket.title === bucketTitle
        );
        if (found) return { nest };
        await delay(POLL_DELAY_MS);
      }
      throw commandError(
        `The host accepted the create request but ${nest} did not appear in time`
      );
    },

    async createFolder({ target, parentId, name }) {
      const folderName = validateDisplayName(name, 'Folder name');
      const current = await getSnapshot(target);
      const priorIds = new Set(current.state.entries.map((entry) => entry.id));
      await sendBucketsAction({
        type: 'create-folder',
        flag: target.flag,
        name: folderName,
        parentId,
      });
      const created = await waitForBucketUpdate(
        target,
        current.state.revision,
        `folder creation for ${folderName}`,
        (snapshot) =>
          snapshot.state.entries.find(
            (entry) =>
              entry.kind === 'folder' &&
              !priorIds.has(entry.id) &&
              entry.name === folderName &&
              entry.parentId === parentId
          )
      );
      return {
        created: created.name,
        id: created.id,
        nest: target.nest,
        parentId: created.parentId,
      };
    },

    async upload({ target, filePath, parentId, name, mime }) {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        throw commandError(`File not found: ${resolvedPath}`);
      }
      const stat = fs.statSync(resolvedPath);
      if (!stat.isFile()) throw commandError(`Not a file: ${resolvedPath}`);
      const displayName = validateDisplayName(
        name ?? path.basename(resolvedPath),
        'File name'
      );
      const contentType = mime ?? mimeFromPath(resolvedPath);
      const current = await getSnapshot(target);
      const priorSessionIds = new Set(
        current.state.sessions.map((session) => session.id)
      );
      const capability = createCapability();

      await sendBucketsAction({
        type: 'begin-upload',
        capability,
        checksum: null,
        flag: target.flag,
        mime: contentType,
        name: displayName,
        parentId,
        size: stat.size,
      });

      let completionAttempted = false;
      let begun: Awaited<ReturnType<typeof waitForUploadSession>> | undefined;
      try {
        const grant = await waitForCapability(() =>
          grantUpload(capability, target.flag.host)
        );
        begun = await waitForUploadSession(
          target,
          priorSessionIds,
          grant.objectId,
          parentId,
          displayName
        );
        const requiredHeaders = Object.fromEntries(grant.requiredHeaders);
        const uploadResponse = await fetch(grant.uploadUrl, {
          method: 'PUT',
          // These headers are part of the GCS signature. Do not add a second
          // Content-Type with different casing: Fetch coalesces duplicate
          // header names and invalidates the signed canonical request.
          headers: requiredHeaders,
          // Bun.file is a lazy Blob. Fetch streams it from disk while retaining
          // a known content length, so large workspace files are not buffered
          // in the hosted bot's heap.
          body: fileUploadBody(resolvedPath),
        });
        if (!uploadResponse.ok) {
          const body = await uploadResponse.text().catch(() => '');
          const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
          const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
          const detail = [code, message].filter(Boolean).join(': ');
          throw commandError(
            `Object upload failed: ${uploadResponse.status} ${uploadResponse.statusText}${detail ? ` (${detail})` : ''}`
          );
        }
        completionAttempted = true;
        await completeUpload(grant.reservationId);
        const ready = await waitForReadyFile(target, begun.entry.id);
        return {
          id: ready.id,
          mime: ready.file.mime,
          name: ready.name,
          nest: target.nest,
          parentId: ready.parentId,
          size: ready.file.size,
          status: ready.file.status,
        };
      } catch (error) {
        if (!completionAttempted && begun) {
          await sendBucketsAction({
            type: 'fail-upload',
            flag: target.flag,
            sessionId: begun.session.id,
            reason: errorMessage(error).slice(0, 500),
          }).catch(() => undefined);
          await sendBucketsAction({
            type: 'delete-entry',
            flag: target.flag,
            id: begun.entry.id,
            recursive: false,
          }).catch(() => undefined);
        }
        throw commandError(
          `Bucket upload failed after the host authorized ${displayName}: ${errorMessage(error)}`
        );
      }
    },

    async read(target, id) {
      const snapshot = await getSnapshot(target);
      const entry = requireReadyFile(snapshot, id);
      if (!isTextMime(entry.file.mime)) {
        throw commandError(
          `File ${id} has MIME type ${entry.file.mime}; the read command only returns text files`
        );
      }
      if (entry.file.size > MAX_TEXT_READ_BYTES) {
        throw commandError(
          `File ${id} is larger than the ${MAX_TEXT_READ_BYTES}-byte text read limit`
        );
      }
      const readUrl = await privateReadUrl(target, entry);
      const response = await fetch(readUrl);
      if (!response.ok) {
        const body = await response.text();
        const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
        const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
        const detail = [code, message].filter(Boolean).join(': ');
        throw commandError(
          `File download failed: ${response.status} ${response.statusText}${detail ? ` (${detail})` : ''}`
        );
      }
      return readBoundedText(response, id);
    },

    async rename(target, id, name) {
      const displayName = validateDisplayName(name, 'Entry name');
      const current = await getSnapshot(target);
      const entry = requireEntry(current, id);
      if (entry.name === displayName) {
        return { id, name: displayName, nest: target.nest };
      }
      await sendBucketsAction({
        type: 'rename-entry',
        flag: target.flag,
        id,
        name: displayName,
      });
      await waitForBucketUpdate(
        target,
        current.state.revision,
        `rename of entry ${id}`,
        (snapshot) =>
          snapshot.state.entries.find(
            (candidate) => candidate.id === id && candidate.name === displayName
          )
      );
      return { id, name: displayName, nest: target.nest };
    },

    async move(target, id, parentId) {
      const current = await getSnapshot(target);
      const entry = requireEntry(current, id);
      if (entry.parentId === parentId) {
        return { id, nest: target.nest, parentId };
      }
      await sendBucketsAction({
        type: 'move-entry',
        flag: target.flag,
        id,
        parentId,
      });
      await waitForBucketUpdate(
        target,
        current.state.revision,
        `move of entry ${id}`,
        (snapshot) =>
          snapshot.state.entries.find(
            (candidate) =>
              candidate.id === id && candidate.parentId === parentId
          )
      );
      return { id, nest: target.nest, parentId };
    },

    async delete(target, id, recursive) {
      const snapshot = await getSnapshot(target);
      const root = requireEntry(snapshot, id);
      if (root.kind === 'file' || recursive) {
        throw commandError(
          'Bot deletion of Bucket files and recursive folders is temporarily disabled until object storage and metadata can be deleted atomically.'
        );
      }
      await sendBucketsAction({
        type: 'delete-entry',
        flag: target.flag,
        id,
        recursive,
      });
      await waitForBucketUpdate(
        target,
        snapshot.state.revision,
        `deletion of folder ${id}`,
        (updated) =>
          updated.state.entries.some((entry) => entry.id === id)
            ? undefined
            : true
      );
      return { deleted: id, nest: target.nest, recursive };
    },

    async setWriters(target, writers) {
      const current = await getSnapshot(target);
      if (sameStrings(current.state.writers, writers)) {
        return { nest: target.nest, writers };
      }
      await sendBucketsAction({
        type: 'set-writers',
        flag: target.flag,
        writers,
      });
      await waitForBucketUpdate(
        target,
        current.state.revision,
        'writer update',
        (snapshot) =>
          sameStrings(snapshot.state.writers, writers) ? true : undefined
      );
      return { nest: target.nest, writers };
    },
  };
}

export function createBucketsDeps(): BucketsDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      // Authentication is always to the bot/current ship. The Bucket host and
      // object store are authorized later with one-operation capabilities.
      await ensureClient();
    },
    buckets: createBucketsOperations(),
  };
}
