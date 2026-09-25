import {
  type BucketsEntry,
  type BucketsFileEntry,
  type BucketsFlag,
  type BucketsSnapshot,
  type BucketsSummary,
  getBucket,
  getBucketReadToken,
  BucketsActionFailed,
  getGroup,
  mintRequestId,
  getBuckets,
  requestBucketReadToken,
  requestBucketsGrant,
  requestBucketsUpload,
  sendBucketsAction,
  BucketsBrokerError,
  grantBucketRead,
} from '@tloncorp/api';
import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ensureClient, normalizeShip } from './api-client';
import { isAllowedAddress, isDeniedHostname } from './media-guard';
import { MIME_TYPES } from './mime-types';
import { createProcessCommandDeps, sleep } from './runtime-deps';
import type {
  BucketTarget,
  BucketsDeps,
  BucketsOperations,
  BucketsEntryListing,
} from './commands/buckets';
import { commandError, errorMessage } from './commands/command';

const STATE_ATTEMPTS = 40;
const POLL_DELAY_MS = 250;
const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;
const BROKER_AUTH_FAILURE_STATUSES = new Set([401, 403]);

type BucketUploadGrant = {
  reservationId: string;
  objectId: string;
  uploadUrl: string;
  requiredHeaders: [string, string][];
};

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
  const groupId = `${normalizeShip(group.host)}/${group.name}`;
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

function flagsMatch(left: BucketsFlag, right: BucketsFlag) {
  return (
    normalizeShip(left.host) === normalizeShip(right.host) &&
    left.name === right.name
  );
}

function bucketNest(flag: BucketsFlag) {
  return `buckets/${normalizeShip(flag.host)}/${flag.name}`;
}

function serializeSnapshot(snapshot: BucketsSummary) {
  return {
    nest: bucketNest(snapshot.flag),
    title: snapshot.state.bucket.title,
    group: `${normalizeShip(snapshot.state.group.host)}/${snapshot.state.group.name}`,
    writers: snapshot.state.writers,
    revision: snapshot.state.revision,
  };
}

function serializeEntry(entry: BucketsEntry): BucketsEntryListing {
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

// Refuse an upload destination this ship should not be sending a file to.
//
// The PUT URL and its headers come back from the Bucket's host, which is any
// ship with a Bucket this bot can write to -- so it is not trusted. Without
// this, a host can point a hosted bot, running inside our own network, at an
// internal service and have it deliver a PUT there. The file itself is not the
// exposure: the host was going to receive it anyway. Reaching what only the
// bot's network can reach is.
//
// Same policy as media-guard's fetches: https only, no credentials in the URL,
// no local or internal hostnames, and every address the name resolves to must
// be public. Redirects are refused at the fetch, since a redirect is a second
// destination nobody checked.
//
// Not closed: DNS rebinding. The name is resolved here and again by fetch, and
// a host controlling its own DNS can answer the two differently. media-guard
// closes that for GETs by pinning the connection to the checked address; doing
// the same for a streamed PUT body is a larger change to its transport.
let uploadDestinationPolicy = {
  resolveHost: async (hostname: string) =>
    (await lookup(hostname, { all: true })).map((entry) => entry.address),
  allowAddress: isAllowedAddress,
};

// Test-only: tests PUT to hostnames that do not resolve.
export function setUploadDestinationPolicyForTests(
  policy: Partial<typeof uploadDestinationPolicy>
) {
  uploadDestinationPolicy = { ...uploadDestinationPolicy, ...policy };
}

async function assertUploadDestination(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw commandError('The Bucket host returned an invalid upload URL');
  }
  if (url.protocol !== 'https:') {
    throw commandError('The Bucket host returned a non-https upload URL');
  }
  if (url.username || url.password) {
    throw commandError(
      'The Bucket host returned an upload URL with credentials'
    );
  }
  // URL keeps the brackets on an IPv6 literal.
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isDeniedHostname(hostname)) {
    throw commandError('The Bucket host returned a local upload URL');
  }
  const addresses = await uploadDestinationPolicy
    .resolveHost(hostname)
    .catch(() => [] as string[]);
  if (addresses.length === 0) {
    throw commandError(
      'The Bucket host returned an upload URL that does not resolve'
    );
  }
  if (
    !addresses.every((address) => uploadDestinationPolicy.allowAddress(address))
  ) {
    throw commandError(
      'The Bucket host returned an upload URL on a private or internal network'
    );
  }
}

// Wait, briefly and without failing, for the local replica to show a change
// the host has already confirmed.
//
// The host answers an action only once it has committed it, and a refusal
// comes back as a thrown BucketsActionFailed -- so by the time an action
// resolves, the answer is the authority on whether it happened, and every
// caller builds its result from that. This wait is for the command after:
// every command starts by reading the local replica, and for a Bucket hosted
// on another ship the answer and the replica's update arrive on two different
// subscriptions, which ames does not order against each other. Returning
// before the replica catches up would leave the next command reading a
// folder that is not there yet.
//
// Which is why it never throws. It used to, and a success whose replica
// update was merely late became a reported failure -- one the model then
// retried into a duplicate folder or a duplicate upload. A failed read is
// likewise just a spent attempt.
let replicaWait = { attempts: STATE_ATTEMPTS, delayMs: POLL_DELAY_MS };

// Test-only. The wait is ten seconds by design, which a test of the case
// where the replica never catches up would spend in full.
export function setReplicaWaitForTests(attempts: number, delayMs: number) {
  replicaWait = { attempts, delayMs };
}

async function awaitReplica<T>(
  target: BucketTarget,
  priorRevision: number,
  select: (snapshot: BucketsSnapshot) => T | undefined
): Promise<T | undefined> {
  for (let attempt = 0; attempt < replicaWait.attempts; attempt += 1) {
    const snapshot = await getSnapshot(target).catch(() => null);
    if (snapshot && snapshot.state.revision > priorRevision) {
      const selected = select(snapshot);
      if (selected !== undefined) return selected;
    }
    await sleep(replicaWait.delayMs);
  }
  return undefined;
}

// Said when the host has confirmed a change the local replica does not show
// yet. The change happened; this is only so the next command is not surprised.
const REPLICA_LAGGING =
  'The host confirmed this, but this ship has not received the update yet; a command run immediately may not see it.';

function sameStrings(left: string[], right: string[]) {
  const normalize = (values: string[]) => [...new Set(values)].sort();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

// Enough of an error body to find storage's <Code> and <Message>. An error
// response is read no further than this: the upload endpoint is chosen by the
// Bucket's host, which is untrusted, and a 4xx/5xx with an endless chunked
// body read whole with .text() would exhaust the hosted bot's heap.
const MAX_ERROR_BODY_BYTES = 8 * 1024;

async function readErrorBody(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < MAX_ERROR_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } catch {
    // What arrived is still worth reporting.
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(Math.min(received, MAX_ERROR_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = bytes.length - offset;
    if (room <= 0) break;
    bytes.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return new TextDecoder().decode(bytes);
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

function mimeFromPath(filePath: string) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
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
    grantBucketRead(token, target.flag.host, entry.file.objectKey);
  try {
    return (await open(readToken.token)).readUrl;
  } catch (cause) {
    // A bare 404 -- no body, so no code -- is storage not having the object,
    // which the shared client can only report as a status. Said plainly here,
    // where it is known to be a read.
    if (
      cause instanceof BucketsBrokerError &&
      cause.status === 404 &&
      cause.code === undefined
    ) {
      throw commandError(
        'Buckets storage has no such file. It may have been deleted, or storage may not be reachable from this ship.'
      );
    }
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
      const snapshot = await getSnapshot(target);
      // Entries are documented as unbounded and the runner buffers all of
      // stdout, so a large Bucket could exhaust the bot's heap or swamp the
      // model's tool result. The metadata is what `show` is for; `files`
      // lists one folder at a time. Neither `files` nor `search` pages or
      // caps its output yet.
      const { entries, ...state } = snapshot.state;
      return { flag: snapshot.flag, state, entryCount: entries.length };
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
        .map(serializeEntry);
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
        host: normalizeShip(group.host),
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
      // Resolving means the host created it. What follows is only waiting
      // for this ship to hold a replica, which for a group hosted elsewhere
      // needs %groups to hand it the channel first -- so a failed read is a
      // spent attempt, and running out of attempts is not a failure. It used
      // to be both, and the model's retry of a Bucket that did exist met
      // "already exists".
      const visible = await awaitReplica({ flag, nest }, -1, (snapshot) =>
        flagsMatch(snapshot.state.group, normalizedGroup) &&
        snapshot.state.bucket.title === bucketTitle
          ? true
          : undefined
      );
      return visible ? { nest } : { nest, note: REPLICA_LAGGING };
    },

    async createFolder({ target, parentId, name }) {
      const folderName = validateDisplayName(name, 'Folder name');
      const current = await getSnapshot(target);
      requireFolder(current, parentId, 'Parent');
      const priorIds = new Set(current.state.entries.map((entry) => entry.id));
      // A refusal throws. Resolving means the folder exists; what the answer
      // does not carry is its id, so that is the one thing read back.
      //
      // The id is found by name and parent among entries that were not there
      // before, which is not a correlation: two clients creating the same name
      // under the same parent from the same snapshot can each find the
      // other's. The host would have to return the new id for that to close.
      await sendBucketsAction({
        type: 'create-folder',
        flag: target.flag,
        name: folderName,
        parentId,
      });
      const created = await awaitReplica(
        target,
        current.state.revision,
        (snapshot) =>
          snapshot.state.entries.find(
            (entry) =>
              entry.kind === 'folder' &&
              !priorIds.has(entry.id) &&
              entry.name === folderName &&
              entry.parentId === parentId
          )
      );
      if (!created) {
        return {
          created: folderName,
          id: null,
          nest: target.nest,
          parentId,
          note: `${REPLICA_LAGGING} List the folder to find its id.`,
        };
      }
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
      // Checked before the try, not left to the host: a missing or file
      // parent would otherwise come back as a refused session, and the catch
      // below reports anything before a grant as the host not authorizing the
      // upload rather than as a bad --parent.
      requireFolder(await getSnapshot(target), parentId, 'Parent');
      try {
        // The host calls storage as itself and answers with the signed URL,
        // so there is nothing to exchange from here. The request id is minted
        // here and kept, though: the host holds this request open across its
        // own call to storage, so a lost response is a real possibility, and
        // without the id the only option is a fresh one -- opening a second
        // session while the first holds a reservation and its quota. The host
        // answers a repeated id with the answer it already gave.
        const openRequestId = mintRequestId();
        const openUpload = () =>
          requestBucketsUpload(
            {
              type: 'begin-upload',
              checksum: null,
              flag: target.flag,
              mime: contentType,
              name: displayName,
              parentId,
              size: stat.size,
            },
            openRequestId
          );
        grant = await openUpload().catch((cause) => {
          // A typed refusal is the host's answer and stands. Anything else
          // never reached it, or its answer never reached us.
          if (cause instanceof BucketsActionFailed) throw cause;
          return openUpload();
        });
        await assertUploadDestination(grant.url);
        const uploadResponse = await fetch(grant.url, {
          method: 'PUT',
          redirect: 'error',
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
          const body = await readErrorBody(uploadResponse);
          const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
          const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
          const detail = [code, message].filter(Boolean).join(': ');
          throw commandError(
            `Object upload failed: ${uploadResponse.status} ${uploadResponse.statusText}${detail ? ` (${detail})` : ''}`
          );
        }
        completionAttempted = true;
        // The answer is the confirmation. The host answers %ok only after the
        // receipt verifies and the entry is published as ready; every other
        // outcome answers an error, which throws. The entry is built from
        // exactly what was sent, so there is nothing left to read back.
        //
        // It used to be read back, once, from the local replica -- which on a
        // Bucket hosted elsewhere is fed by a different subscription than the
        // answer, so it could still lack the entry. That reported a landed
        // file as failed, skipped the cancel because completion had been
        // attempted, and left the model to retry into a duplicate.
        const before = await getSnapshot(target).catch(() => null);
        // One id, resubmitted once if the answer is lost, as begin-upload
        // does. The host holds this request open while it verifies the
        // receipt with storage, which makes it the likeliest place for an
        // answer to go missing -- and a lost answer after a successful PUT
        // was reported as a failure, with no cancel, and retried into a
        // duplicate. The host replays a settled id and holds a repeat of an
        // in-flight one open for the same answer, so resubmitting is safe.
        const finishRequestId = mintRequestId();
        const finish = () =>
          sendBucketsAction(
            {
              type: 'finish-upload',
              flag: target.flag,
              sessionId: grant!.session,
            },
            finishRequestId
          );
        await finish().catch((cause) => {
          if (cause instanceof BucketsActionFailed) throw cause;
          return finish();
        });
        const visible = await awaitReplica(
          target,
          before?.state.revision ?? -1,
          (snapshot) =>
            snapshot.state.entries.some(
              (entry) =>
                entry.kind === 'file' &&
                entry.id === grant!.entryId &&
                entry.file.status === 'ready'
            )
              ? true
              : undefined
        );
        return {
          id: grant.entryId,
          mime: contentType,
          name: displayName,
          nest: target.nest,
          parentId,
          size: stat.size,
          status: 'ready' as const,
          ...(visible ? {} : { note: REPLICA_LAGGING }),
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
        const body = await readErrorBody(response);
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
      const visible = await awaitReplica(
        target,
        current.state.revision,
        (snapshot) =>
          snapshot.state.entries.find(
            (candidate) => candidate.id === id && candidate.name === displayName
          )
      );
      return {
        id,
        name: displayName,
        nest: target.nest,
        ...(visible ? {} : { note: REPLICA_LAGGING }),
      };
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
      const visible = await awaitReplica(
        target,
        current.state.revision,
        (snapshot) =>
          snapshot.state.entries.find(
            (candidate) =>
              candidate.id === id && candidate.parentId === parentId
          )
      );
      return {
        id,
        nest: target.nest,
        parentId,
        ...(visible ? {} : { note: REPLICA_LAGGING }),
      };
    },

    async delete(target, id) {
      const snapshot = await getSnapshot(target);
      const root = requireEntry(snapshot, id);
      if (root.kind === 'file') {
        throw commandError(
          'Bot deletion of Bucket files is temporarily disabled until object storage and metadata can be deleted atomically.'
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
        recursive: false,
      });
      const visible = await awaitReplica(
        target,
        snapshot.state.revision,
        (updated) =>
          updated.state.entries.some((entry) => entry.id === id)
            ? undefined
            : true
      );
      return {
        deleted: id,
        nest: target.nest,
        ...(visible ? {} : { note: REPLICA_LAGGING }),
      };
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
      const visible = await awaitReplica(
        target,
        current.state.revision,
        (snapshot) =>
          sameStrings(snapshot.state.writers, writers) ? true : undefined
      );
      return {
        nest: target.nest,
        writers,
        ...(visible ? {} : { note: REPLICA_LAGGING }),
      };
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
    buckets: withRefusalsAsCommandErrors(createBucketsOperations()),
  };
}

// Every refusal from the host arrives as a BucketsActionFailed, thrown by
// sendBucketsAction -- the client never hands back an error body. This is the
// one place a refusal becomes a command error. The call sites used to test
// each answer for an error body instead, which could not happen, so a refusal
// escaped every operation as an unexpected error.
//
// Here rather than in the command, which may not import API values: the
// runtime is the only layer that talks to the API.
function withRefusalsAsCommandErrors(
  operations: BucketsOperations
): BucketsOperations {
  const wrapped = {} as Record<string, unknown>;
  for (const [name, operation] of Object.entries(operations)) {
    wrapped[name] = async (...args: unknown[]) => {
      try {
        return await (operation as (...a: unknown[]) => Promise<unknown>)(
          ...args
        );
      } catch (error) {
        if (error instanceof BucketsActionFailed) {
          throw commandError(`The Bucket host refused this: ${error.message}`);
        }
        throw error;
      }
    };
  }
  return wrapped as unknown as BucketsOperations;
}
