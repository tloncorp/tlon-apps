import {
  type BucketsEntry,
  type BucketsFileEntry,
  type BucketsFlag,
  type BucketsSnapshot,
  type BucketsSummary,
  getBucket,
  getBucketReadToken,
  getGroup,
  getBuckets,
  requestBucketReadToken,
  requestBucketsGrant,
  requestBucketsUpload,
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
const STATE_ATTEMPTS = 40;
const POLL_DELAY_MS = 250;
const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;
const BROKER_AUTH_FAILURE_STATUSES = new Set([401, 403]);

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

/**
 * Refuse role names the group does not have.
 *
 * Both reader and writer lists are reconciled against the group's roles, and
 * an id that is not there is dropped. What is left of a list of one typo is
 * an empty list -- whose meaning in this protocol is not "nobody" but
 * "everyone", so the mistake opens a Bucket rather than closing it.
 */
async function assertGroupRoles(group: BucketsFlag, roles: string[]) {
  if (roles.length === 0) return;
  const groupId = `${normalizeHost(group.host)}/${group.name}`;
  const found = await getGroup(groupId).catch(() => null);
  if (!found) {
    throw commandError(`Could not read roles for group ${groupId}`);
  }
  const known = new Set((found.roles ?? []).map((role) => role.id));
  const unknown = roles.filter((role) => !known.has(role));
  if (unknown.length > 0) {
    throw commandError(
      `Group ${groupId} has no role named ${unknown.join(', ')}`
    );
  }
}

function hostName(host: string) {
  return host.replace(/^~/, '');
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function serializeSnapshot(snapshot: BucketsSummary) {
  return {
    nest: bucketNest(snapshot.flag),
    title: snapshot.state.bucket.title,
    group: `${normalizeHost(snapshot.state.group.host)}/${snapshot.state.group.name}`,
    writers: snapshot.state.writers,
    revision: snapshot.state.revision,
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
  const snapshot = await getBucket(target.flag);
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

// Read once rather than poll. Completion is the answer to the host's own
// call to storage, so the entry is published before %finish-upload returns.
async function readyFile(target: BucketTarget, id: number) {
  const snapshot = await getSnapshot(target);
  const entry = snapshot.state.entries.find(
    (candidate): candidate is BucketsFileEntry =>
      candidate.kind === 'file' && candidate.id === id
  );
  if (entry?.file.status === 'ready') return entry;
  if (entry?.file.status === 'failed') {
    throw commandError(`The Bucket host marked file ${id} failed`);
  }
  throw commandError(`The Bucket host did not publish file ${id}`);
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

/**
 * A parent has to exist and be a folder.
 *
 * The snapshot in hand already proves it either way, so checking here turns
 * what the host would refuse -- after a poke that succeeds locally and ten
 * seconds of polling for a change that never comes -- into an answer the
 * caller can act on.
 */
function requireFolder(
  snapshot: BucketsSnapshot,
  parentId: number | null,
  what: string
) {
  if (parentId === null) return;
  const parent = snapshot.state.entries.find((entry) => entry.id === parentId);
  if (!parent) {
    throw commandError(`${what} ${parentId} does not exist`);
  }
  if (parent.kind !== 'folder') {
    throw commandError(`${what} ${parentId} is a file, not a folder`);
  }
}

/**
 * The media type without its parameters, lowercased.
 *
 * Stored types are whatever the uploader sent, so `Text/Plain` and
 * `application/json; charset=utf-8` are both valid and both missed by an
 * exact comparison.
 */
function baseMime(mime: string) {
  return mime.split(';')[0].trim().toLowerCase();
}

function isTextMime(mime: string) {
  const base = baseMime(mime);
  return (
    base.startsWith('text/') ||
    base === 'application/json' ||
    base === 'application/javascript' ||
    base === 'application/xml' ||
    base.endsWith('+json') ||
    base.endsWith('+xml')
  );
}

async function privateReadUrl(target: BucketTarget, entry: BucketsFileEntry) {
  const readToken =
    (await getBucketReadToken(target.flag)) ??
    (await requestBucketReadToken(target.flag));
  const open = (token: string) =>
    grantRead(token, target.flag.host, entry.file.objectKey);
  try {
    return (await open(readToken.token)).readUrl;
  } catch (cause) {
    // A host rotation can invalidate the locally held token between the scry
    // and broker request. Mint once more before treating it as a real failure.
    if (
      !(cause instanceof BucketsBrokerError) ||
      !BROKER_AUTH_FAILURE_STATUSES.has(cause.status)
    ) {
      throw cause;
    }
    return (await open((await requestBucketReadToken(target.flag)).token))
      .readUrl;
  }
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
      // Otherwise a bad --parent is indistinguishable from an empty folder,
      // and a caller can go on to mutate against a tree that is not there.
      requireFolder(snapshot, parentId, 'Parent');
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

    async create({ group, title, name, readers, writers }) {
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
      // Checked before the create, because both lists mean the opposite of
      // restrictive when they are empty: a role the group does not have is
      // dropped by reconciliation, and what is left is "everyone".
      await assertGroupRoles(normalizedGroup, [
        ...(readers ?? []),
        ...(writers ?? []),
      ]);
      await sendBucketsAction({
        type: 'create',
        group: normalizedGroup,
        name: bucketName,
        readers: readers ?? [],
        title: bucketTitle,
        writers: writers ?? [],
      });
      for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
        const found = await getBucket(flag);
        if (
          found &&
          flagsMatch(found.state.group, normalizedGroup) &&
          found.state.bucket.title === bucketTitle
        ) {
          return { nest };
        }
        await delay(POLL_DELAY_MS);
      }
      throw commandError(
        `The host accepted the create request but ${nest} did not appear in time`
      );
    },

    async createFolder({ target, parentId, name }) {
      const folderName = validateDisplayName(name, 'Folder name');
      const current = await getSnapshot(target);
      requireFolder(current, parentId, 'Parent');
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
      let completionAttempted = false;
      let grant: Awaited<ReturnType<typeof requestBucketsUpload>> | undefined;
      try {
        await getSnapshot(target);
        // The host calls storage as itself and answers with the signed URL,
        // so there is nothing to exchange from here.
        grant = await requestBucketsUpload({
          type: 'begin-upload',
          checksum: null,
          flag: target.flag,
          mime: contentType,
          name: displayName,
          parentId,
          size: stat.size,
        });
        const uploadResponse = await fetch(grant.url, {
          method: 'PUT',
          // These headers are part of the GCS signature. Do not add a second
          // Content-Type with different casing: Fetch coalesces duplicate
          // header names and invalidates the signed canonical request.
          headers: Object.fromEntries(grant.headers),
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
        // The host settles with storage and publishes the entry in the same
        // step, so by the time this returns the manifest already has it --
        // this used to poll for the entry to appear.
        await sendBucketsAction({
          type: 'finish-upload',
          flag: target.flag,
          sessionId: grant.session,
        });
        const ready = await readyFile(target, grant.entryId);
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
        // One cancel: the host releases the storage reservation as part of
        // it, so the quota reserved before the first byte moved does not sit
        // held until the reservation lapses.
        if (!completionAttempted && grant) {
          await sendBucketsAction({
            type: 'cancel-upload',
            flag: target.flag,
            sessionId: grant.session,
            reason: errorMessage(error).slice(0, 500),
          }).catch(() => undefined);
        }
        throw commandError(
          grant
            ? `Bucket upload failed after the host authorized ${displayName}: ${errorMessage(error)}`
            : `Bucket host did not authorize ${displayName}: ${errorMessage(error)}`
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
      requireFolder(current, parentId, 'Destination');
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
      // The host refuses a non-recursive delete of a folder with children, so
      // sending it buys a generic confirmation timeout instead of the reason.
      const children = snapshot.state.entries.filter(
        (entry) => entry.parentId === id
      );
      if (children.length > 0) {
        throw commandError(
          `Folder ${id} is not empty; it holds ${children.length} ${
            children.length === 1 ? 'entry' : 'entries'
          }`
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
      // A role the group does not have is silently dropped by %buckets'
      // reconciliation, and an empty writer set means every reader may write
      // -- so a misspelled role widens access instead of narrowing it.
      await assertGroupRoles(current.state.group, writers);
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
