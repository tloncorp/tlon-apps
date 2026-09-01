import {
  createChannel as apiCreateChannel,
  editPost as apiEditPost,
  sendPost as apiSendPost,
  updateChannel as apiUpdateChannel,
  uploadFile as apiUploadFile,
  getChannelPosts,
  getCurrentUserId,
  scry,
} from '@tloncorp/api';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { StructuredChannelDescriptionPayload } from '@tloncorp/api/client/channelContentConfig';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as channelContentConfigModule from '@tloncorp/api/client/channelContentConfig';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { constructStory } from '@tloncorp/api/urbit';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { ensureClient, getConfig } from './api-client';
import {
  DEFAULT_OBSERVATION_BUDGET,
  type SurfaceDeps,
  SurfaceGroupChannel,
  SurfacePostRecord,
  SurfaceRecordKind,
  type SurfaceAssetFetch,
  type SurfaceStoragePreflight,
  SurfaceTemplateDetail,
  SurfaceTemplateStore,
  SurfaceTemplateSummary,
  SurfaceValidation,
  surfaceError,
} from './commands/surface-common';
import { shipCanStoreUploads } from './commands/upload';
import { normalizeShip } from './notes-migrate';
import { formatSurfaceLintResult, lintSurfaceBundle } from './surface-lint';

/**
 * Real dependencies for the `surface *` commands.
 *
 * The surface schemas, the pointer parser and the reducer come in through
 * package SUBPATHS rather than the package root, for the reason
 * `surface-lint.ts` records: unit tests preload a process-wide
 * `mock.module('@tloncorp/api', …)` whose shape does not carry the surface
 * exports, and a root import would resolve to it. Subpaths reach the real
 * modules, so the CLI validates and folds with exactly the implementation
 * the app clients use.
 */

type ApiModule = typeof import('@tloncorp/api');

const {
  SURFACE_CAPS,
  SurfaceEventEntrySchema,
  SurfaceSnapshotEntrySchema,
  SurfaceSpecMirrorEntrySchema,
  SurfaceSpecSchema,
  readSurfaceSpec,
} = surfaceSchemasModule as Pick<
  ApiModule,
  | 'SURFACE_CAPS'
  | 'SurfaceEventEntrySchema'
  | 'SurfaceSnapshotEntrySchema'
  | 'SurfaceSpecMirrorEntrySchema'
  | 'SurfaceSpecSchema'
  | 'readSurfaceSpec'
>;
const { reduceSurface } = surfaceReducerModule as Pick<
  ApiModule,
  'reduceSurface'
>;
const { parsePointer } = surfaceJsonPointerModule as Pick<
  ApiModule,
  'parsePointer'
>;
const { CollectionRendererId, DraftInputId, PostContentRendererId } =
  channelContentConfigModule as Pick<
    ApiModule,
    'CollectionRendererId' | 'DraftInputId' | 'PostContentRendererId'
  >;
const SCDP =
  StructuredChannelDescriptionPayload as ApiModule['StructuredChannelDescriptionPayload'];

const ENTRY_SCHEMAS = {
  event: SurfaceEventEntrySchema,
  snapshot: SurfaceSnapshotEntrySchema,
  spec: SurfaceSpecMirrorEntrySchema,
} as const;

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

function zodIssues(error: {
  issues?: { path?: unknown[]; message: string }[];
}) {
  return (error.issues ?? []).map((issue) => {
    const where = (issue.path ?? []).join('.');
    return where ? `${where}: ${issue.message}` : issue.message;
  });
}

function validate(
  schema: { safeParse(value: unknown): unknown },
  value: unknown
): SurfaceValidation {
  const result = schema.safeParse(value) as
    | { success: true }
    | {
        success: false;
        error: { issues?: { path?: unknown[]; message: string }[] };
      };
  return result.success
    ? { ok: true }
    : { ok: false, issues: zodIssues(result.error) };
}

/* ------------------------------------------------------------------ */
/* Ship reads                                                          */
/* ------------------------------------------------------------------ */

interface RawGroupChannels {
  channels?: Record<string, SurfaceGroupChannel>;
}

/**
 * The group's channel listings, straight from `%groups` with no client-side
 * transform. `/v2/groups/<flag>` rather than the `ui` variant because the
 * `meta.description` bytes are the thing being compared — a publish confirms
 * itself against what the ship holds, not against a rendering of it.
 */
async function readGroupChannels(
  groupId: string
): Promise<Record<string, SurfaceGroupChannel> | null> {
  try {
    const group = await scry<RawGroupChannels>({
      app: 'groups',
      path: `/v2/groups/${groupId}`,
    });
    return group?.channels ?? {};
  } catch {
    return null;
  }
}

async function readGroupAdmin(groupId: string) {
  try {
    return await scry<{
      admins?: string[];
      seats?: Record<string, { roles?: string[] }>;
    }>({ app: 'groups', path: `/v2/ui/groups/${groupId}` });
  } catch {
    return null;
  }
}

async function readChannelNests() {
  try {
    return await scry<Record<string, { perms?: { group?: string } }>>({
      app: 'channels',
      path: '/v3/channels',
    });
  } catch {
    return {};
  }
}

/**
 * A post's kind, straight off the essay `%channels` holds.
 *
 * The client post model drops the wire kind, so this is the only way to see
 * whether a written record actually carries `/chat/surface/...`. It is what
 * catches an edit that silently rewrote a surface post to `/chat` — the
 * server's `%edit` arm replaces the essay without re-checking kind.
 */
async function readPostKind(
  channelId: string,
  postId: string
): Promise<string | null> {
  try {
    const post = await scry<{ essay?: { kind?: unknown } }>({
      app: 'channels',
      path: `/v5/${channelId}/posts/post/${postId}`,
    });
    const kind = post?.essay?.kind;
    return typeof kind === 'string' ? kind : null;
  } catch {
    return null;
  }
}

function toSurfacePostRecord(post: {
  id: string;
  authorId?: string | null;
  sentAt?: number | null;
  sequenceNum?: number | null;
  isEdited?: boolean | null;
  isDeleted?: boolean | null;
  blob?: string | null;
}): SurfacePostRecord {
  return {
    id: post.id,
    authorId: post.authorId ?? '',
    sentAt: post.sentAt ?? 0,
    sequenceNum: post.sequenceNum ?? null,
    isEdited: post.isEdited ?? null,
    isDeleted: post.isDeleted ?? null,
    blob: post.blob ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

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

function isTlonHostingForced(): boolean {
  const raw = (process.env.TLON_HOSTING ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Whether this ship could host a bundle. Mirrors `upload`'s pre-flight
 * exactly — same predicate, same two-way reason — because "no storage at
 * all" and "storage but no bucket" are fixed in different places and a
 * dashboard that cannot host code is dead on arrival either way. A scry
 * that cannot be read returns null: unknown is not the same as incapable.
 */
async function storagePreflight() {
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
        hosted: isTlonHostingForced(),
        credentials,
        configuration,
      })
    ) {
      return { canStore: true as const };
    }
    const hasCustomS3 = Boolean(
      credentials?.accessKeyId &&
      credentials?.endpoint &&
      credentials?.secretAccessKey
    );
    return {
      canStore: false as const,
      reason: hasCustomS3 ? ('no-bucket' as const) : ('no-storage' as const),
    };
  } catch {
    return null;
  }
}

/**
 * `Blob` over the exact bytes, without copying and without tripping the
 * `ArrayBufferLike`/`ArrayBuffer` narrowing TS applies to a typed array's
 * `.buffer`.
 */
function bytesAsBlob(bytes: Uint8Array, contentType: string): Blob {
  return new Blob(
    [
      new Uint8Array(
        bytes.buffer as ArrayBuffer,
        bytes.byteOffset,
        bytes.byteLength
      ),
    ],
    { type: contentType }
  );
}

async function uploadBundleToShipStorage(input: {
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ url: string }> {
  const result = await apiUploadFile({
    blob: bytesAsBlob(input.bytes, input.contentType),
    contentType: input.contentType,
    fileName: input.fileName,
    ...(isTlonHostingForced()
      ? { hostedDetection: 'assume-hosted' as const }
      : {}),
  });
  return { url: result.url };
}

/**
 * Reads a published bundle back out of storage.
 *
 * A plain GET, deliberately: the client does exactly this
 * (`useSurfaceBundle`'s `fetchBundleText`) and for the same reason — the
 * sha256 in the channel's definition is the authority, so the transport has
 * no trust to earn. The caller hashes what comes back and refuses on
 * mismatch; nothing here decides whether the bytes are the right ones.
 *
 * `Content-Length` is checked before the body is buffered, mirroring the
 * client's pre-buffer short-circuit. The header is advisory — absent, or a
 * lie — so it can only ever short-circuit, and it is deliberately the ONLY
 * size check here: the authoritative measurement is the caller's, over the
 * bytes it actually holds, and a second copy of the cap in this function
 * would make the caller's copy unreachable in production and leave it
 * exercised only by the test double.
 *
 * Known gap, the same one the client documents: a body that omits or
 * under-reports its length is still buffered once before the caller refuses
 * it. Closing it needs streaming enforcement, which neither side has yet.
 */
async function fetchSurfaceAsset(input: {
  url: string;
  maxBytes: number;
}): Promise<SurfaceAssetFetch> {
  let response: Response;
  try {
    response = await fetch(input.url);
  } catch (error) {
    return {
      ok: false,
      reason: 'fetch-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: 'fetch-failed',
      detail:
        `storage answered ${response.status} ${response.statusText}`.trim(),
    };
  }
  const declared = response.headers.get('content-length');
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > input.maxBytes) {
      return {
        ok: false,
        reason: 'oversize',
        detail: `storage declared ${declaredBytes} bytes, over the ${input.maxBytes}-byte cap`,
      };
    }
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    return {
      ok: false,
      reason: 'fetch-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  return { ok: true, bytes };
}

/* ------------------------------------------------------------------ */
/* Dev storage                                                         */
/* ------------------------------------------------------------------ */

/**
 * Names a local bundle store — `pnpm seed:storage`, or the server
 * `pnpm seed:surfaces` already runs — and makes `surface publish` store
 * bundles there instead of through the ship's S3-compatible storage. It is
 * what lets the publish loop run against the fakeships, where there is no
 * bucket to provision and provisioning one is an out-of-repo human step.
 *
 * This variable is the ONLY way in, and there is no fallback in either
 * direction:
 *
 *  - Unset, nothing changes. A ship with no storage still fails
 *    `storage-unavailable` exactly as before — dev storage is never reached
 *    *because* real storage was missing, only because someone named it.
 *  - Set, it is not enough. Both the store and the ship the CLI is talking
 *    to must be loopback, and a mismatch is a refusal, not a quiet fallback
 *    to real storage. So a variable left in a shell profile cannot follow a
 *    developer onto a real ship and put a `127.0.0.1` `assetRef` into a
 *    channel other people read.
 *
 * Engagement is announced on stderr on first use, naming the store and the
 * ship, so a publisher reading the command's output can never be unsure
 * which storage they hit. stderr rather than stdout because `--json` owns
 * stdout.
 */
const DEV_STORAGE_ENV = 'TLON_SURFACE_DEV_STORAGE';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function isLoopbackUrl(raw: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function devStorageOrigin(configured: string): string {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw surfaceError(
      'storage-unavailable',
      `${DEV_STORAGE_ENV} is set to "${configured}", which is not a URL. Set it to the dev store's origin (for example http://127.0.0.1:4321), or unset it to publish through the ship's own storage.`,
      { devStorage: configured }
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw surfaceError(
      'storage-unavailable',
      `${DEV_STORAGE_ENV} is set to "${configured}", whose scheme is not http(s).`,
      { devStorage: configured }
    );
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw surfaceError(
      'storage-unavailable',
      `${DEV_STORAGE_ENV} points at ${url.hostname}, which is not loopback. Dev storage is a local stand-in; pointing it at a real host would put an unreviewed bucket behind every bundle this CLI publishes.`,
      { devStorage: configured }
    );
  }
  return url.origin;
}

interface DevStorage {
  storagePreflight(): Promise<SurfaceStoragePreflight>;
  uploadBundle(input: {
    fileName: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ url: string }>;
}

/**
 * Reads the environment. Returns null when dev storage was not asked for —
 * every validation is deferred to first use, because `createSurfaceDeps`
 * runs before the command does and a bad variable must not turn
 * `surface --help` into a crash.
 */
function createDevStorage(): DevStorage | null {
  const configured = (process.env[DEV_STORAGE_ENV] ?? '').trim();
  if (!configured) return null;

  let announced = false;

  function engage(): string {
    const origin = devStorageOrigin(configured);
    const shipUrl = getConfig().url;
    if (!isLoopbackUrl(shipUrl)) {
      throw surfaceError(
        'storage-unavailable',
        `${DEV_STORAGE_ENV} is set, but this CLI is talking to ${shipUrl}, which is not a local ship. Dev storage is refused rather than used against a real ship: an assetRef on ${origin} resolves for nobody but you. Unset ${DEV_STORAGE_ENV} to publish through this ship's own storage.`,
        { devStorage: origin, ship: shipUrl }
      );
    }
    if (!announced) {
      announced = true;
      process.stderr.write(
        `DEV STORAGE ENGAGED — ${DEV_STORAGE_ENV}=${origin}\n` +
          `  Bundles are stored there, NOT in ${shipUrl}'s remote storage.\n`
      );
    }
    return origin;
  }

  return {
    storagePreflight: async () => {
      engage();
      return { canStore: true };
    },
    uploadBundle: async ({ fileName, bytes, contentType }) => {
      const origin = engage();
      // The key is `fileName` verbatim — `bundleFileName(sha256)`, the
      // bundle's own hash. The dev store refuses any other shape, so a
      // publish path that started minting timestamped keys would fail here
      // rather than quietly produce two URLs for identical bytes.
      const target = `${origin}/${fileName}`;
      const response = await fetch(target, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: bytesAsBlob(bytes, contentType),
      });
      if (!response.ok) {
        throw new Error(
          `dev storage at ${origin} refused ${fileName}: ${response.status} ${await response.text()}`
        );
      }
      const payload = (await response.json()) as { url?: unknown };
      if (typeof payload.url !== 'string' || payload.url.length === 0) {
        throw new Error(`dev storage at ${origin} returned no URL`);
      }
      process.stderr.write(`  stored ${fileName} -> ${payload.url}\n`);
      return { url: payload.url };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const TEMPLATE_BUNDLE_NAMES = ['app.js', 'bundle.js', 'index.js'];

function packageRoot(): string {
  // Correct when running from source, and MEANINGLESS in the compiled
  // binary: `bun build --compile` bakes `__dirname` as a literal, so this
  // returns the build machine's checkout path. The shipped CLI therefore
  // gets its catalogue location from `TLON_SURFACE_TEMPLATES_DIR`, which
  // `bin/tlon.js` sets from the wrapper package (the only place that knows
  // where `skills/` actually landed). This stays as the source-mode path.
  return path.resolve(__dirname, '..');
}

function templatesRoot(): string {
  const override = process.env.TLON_SURFACE_TEMPLATES_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(packageRoot(), 'skills', 'surfaces', 'templates');
}

function readTemplateSummary(
  root: string,
  name: string
): SurfaceTemplateSummary {
  const dir = path.join(root, name);
  // A failed lookup is a failed lookup. This used to fall through to
  // `readdirSync(dir).filter('.js')[0]` when none of the expected names
  // existed — an ARBITRARY file, ordered by the filesystem rather than by
  // anything a caller could predict, returned in the same field a real
  // bundle occupies. `surface templates show` then handed that path to a
  // bot as the template's bundle, at exit code 0, with nothing anywhere
  // saying a lookup had failed. Absence is now reported as absence, and
  // `bundleAbsence` carries the evidence the refusal is written from.
  const bundle =
    TEMPLATE_BUNDLE_NAMES.map((candidate) => path.join(dir, candidate)).find(
      (candidate) => fs.existsSync(candidate)
    ) ?? null;
  const bundleAbsence =
    bundle === null
      ? {
          expected: TEMPLATE_BUNDLE_NAMES,
          found: fs.readdirSync(dir).sort(),
        }
      : null;
  const specPath = path.join(dir, 'spec.json');
  const notesPath = path.join(dir, 'NOTES.md');
  let title: string | null = null;
  if (fs.existsSync(specPath)) {
    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      if (spec && typeof spec.title === 'string') title = spec.title;
    } catch {
      title = null;
    }
  }
  return {
    name,
    title,
    bundleAbsence,
    files: {
      bundle,
      spec: fs.existsSync(specPath) ? specPath : null,
      notes: fs.existsSync(notesPath) ? notesPath : null,
    },
  };
}

/**
 * The template catalogue, read from disk on every call.
 *
 * Everything here tolerates absence: the directory may not exist at all
 * (the templates land in a later session), a template may be missing its
 * spec or its notes, and a spec may not parse. None of that is an error
 * worth raising from a browse command — it is reported as what it is.
 */
function createTemplateStore(): SurfaceTemplateStore {
  return {
    root: templatesRoot,
    exists: () => {
      const root = templatesRoot();
      return fs.existsSync(root) && fs.statSync(root).isDirectory();
    },
    list: () => {
      const root = templatesRoot();
      if (!fs.existsSync(root)) return [];
      return fs
        .readdirSync(root)
        .filter((entry) => {
          const full = path.join(root, entry);
          return !entry.startsWith('.') && fs.statSync(full).isDirectory();
        })
        .sort()
        .map((entry) => readTemplateSummary(root, entry));
    },
    read: (name: string): SurfaceTemplateDetail | null => {
      const root = templatesRoot();
      // Refuse any name that is not a plain directory entry: a browse
      // command must not be a path traversal.
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return null;
      const dir = path.join(root, name);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
      const summary = readTemplateSummary(root, name);
      const specText = summary.files.spec
        ? fs.readFileSync(summary.files.spec, 'utf-8')
        : null;
      let spec: unknown = null;
      if (specText !== null) {
        try {
          spec = JSON.parse(specText);
        } catch {
          spec = null;
        }
      }
      return {
        ...summary,
        spec,
        specText,
        notes: summary.files.notes
          ? fs.readFileSync(summary.files.notes, 'utf-8')
          : null,
        bundleBytes: summary.files.bundle
          ? fs.statSync(summary.files.bundle).size
          : null,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * A random channel name. Random by default is a correctness measure, not a
 * style: a name is single-use on a ship forever (D50), so a readable slug
 * is a name that can be burned.
 */
function randomSlug(): string {
  const bytes = randomBytes(8);
  let slug = 'dash-';
  for (const byte of bytes) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }
  return slug;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function createSurfaceDeps(): SurfaceDeps {
  const devStorage = createDevStorage();
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      // `%groups /v1/groups` and `%channels /v4` are not optional overhead:
      // `createChannel` is a TRACKED poke, and a tracked poke's watcher is
      // fed by the subscription stream. With no subscriptions open the
      // watcher can never fire, so every `surface create` created the
      // channel on the ship and then threw `TimeoutError` 20s later —
      // reporting failure for work that succeeded, and burning the channel
      // name in the process (D50 makes a name single-use forever). Same
      // list as `groups.ts`, for the same reason.
      await ensureClient(['groups', 'channels']);
    },
    actingShip: () => getCurrentUserId(),
    observationBudget: DEFAULT_OBSERVATION_BUDGET,
    normalizeShip,
    now: () => Date.now(),
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    randomSlug,
    surfaceContentConfiguration: {
      draftInput: DraftInputId.none,
      defaultPostContentRenderer: PostContentRendererId.chat,
      defaultPostCollectionRenderer: CollectionRendererId.surface,
    },

    readGroupAdmin,
    readGroupChannels,
    readChannelNests,
    readPostPage: async ({ channelId, cursor, mode, count }) => {
      const result = await getChannelPosts({
        channelId,
        cursor,
        mode,
        count,
        includeReplies: false,
        skipGapFill: true,
      });
      return {
        posts: (result.posts ?? []).map(toSurfacePostRecord),
        older: result.older ?? null,
        totalPosts:
          typeof result.totalPosts === 'number' ? result.totalPosts : 0,
      };
    },
    readPostKind,

    createChannel: async (input) => {
      await apiCreateChannel({ ...input, meta: null });
    },
    writeGroupChannel: async ({ groupId, channelId, channel }) => {
      await apiUpdateChannel({ groupId, channelId, channel });
    },
    sendSurfacePost: async ({
      channelId,
      kindTail,
      fallback,
      blob,
      sentAt,
    }) => {
      await apiSendPost({
        channelId,
        authorId: getCurrentUserId(),
        content: constructStory([fallback]),
        blob,
        sentAt,
        kindTail,
      });
    },
    editSurfacePost: async ({
      channelId,
      postId,
      kindTail,
      fallback,
      blob,
      sentAt,
    }) => {
      await apiEditPost({
        channelId,
        postId,
        authorId: getCurrentUserId(),
        content: constructStory([fallback]),
        sentAt,
        // The kind tail is mandatory on the way back out: `%edit` stores the
        // submitted essay wholesale without re-checking kind, so omitting it
        // would quietly turn a surface record into an ordinary chat message.
        kindTail,
        ...(blob === undefined ? {} : { blob }),
      });
    },

    // Dev storage replaces BOTH halves or neither. Replacing only the
    // upload would leave publish gated on a preflight that reads a bucket
    // nothing is going to be written to; replacing only the preflight would
    // pass the gate and then upload to storage that isn't there.
    storagePreflight: devStorage
      ? devStorage.storagePreflight
      : storagePreflight,
    uploadBundle: devStorage
      ? devStorage.uploadBundle
      : uploadBundleToShipStorage,

    description: {
      decode: (encoded) => SCDP.decode(encoded) as Record<string, unknown>,
      encode: (payload) => SCDP.encode(payload as never) ?? '',
      rawSurfaceSpec: (encoded) =>
        SCDP.rawPersistenceFields(encoded).surfaceSpec,
    },
    readSpecText: (raw) => readSurfaceSpec(raw),
    validateSpecValue: (value) => validate(SurfaceSpecSchema, value),
    validateEntry: (kind: SurfaceRecordKind, value) =>
      validate(ENTRY_SCHEMAS[kind], value),
    parsePointer: (pointerPath) => parsePointer(pointerPath),
    reduce: (input) => reduceSurface(input),
    caps: {
      opsPerEvent: SURFACE_CAPS.opsPerEvent,
      bundleSize: SURFACE_CAPS.bundleSize,
    },
    lint: (input) => lintSurfaceBundle(input),
    formatLint: (result) => formatSurfaceLintResult(result),

    fetchAsset: fetchSurfaceAsset,
    readTextFile: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
    readBinaryFile: (filePath: string) => fs.readFileSync(filePath),
    writeBinaryFile: (filePath: string, bytes: Uint8Array) => {
      fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
      fs.writeFileSync(filePath, bytes);
    },
    sha256Hex: (bytes: Uint8Array) =>
      createHash('sha256').update(bytes).digest('hex'),
    templates: createTemplateStore(),
  };
}
