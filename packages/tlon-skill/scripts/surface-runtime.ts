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

import { ensureClient } from './api-client';
import {
  DEFAULT_OBSERVATION_BUDGET,
  type SurfaceDeps,
  SurfaceGroupChannel,
  SurfacePostRecord,
  SurfaceRecordKind,
  SurfaceTemplateDetail,
  SurfaceTemplateStore,
  SurfaceTemplateSummary,
  SurfaceValidation,
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
  const bundle =
    TEMPLATE_BUNDLE_NAMES.map((candidate) => path.join(dir, candidate)).find(
      (candidate) => fs.existsSync(candidate)
    ) ??
    fs
      .readdirSync(dir)
      .filter((entry) => entry.endsWith('.js'))
      .map((entry) => path.join(dir, entry))[0] ??
    null;
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

    storagePreflight,
    uploadBundle: async ({ fileName, bytes, contentType }) => {
      const blob = new Blob(
        [
          new Uint8Array(
            bytes.buffer as ArrayBuffer,
            bytes.byteOffset,
            bytes.byteLength
          ),
        ],
        { type: contentType }
      );
      const result = await apiUploadFile({
        blob,
        contentType,
        fileName,
        ...(isTlonHostingForced()
          ? { hostedDetection: 'assume-hosted' as const }
          : {}),
      });
      return { url: result.url };
    },

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

    readTextFile: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
    readBinaryFile: (filePath: string) => fs.readFileSync(filePath),
    sha256Hex: (bytes: Uint8Array) =>
      createHash('sha256').update(bytes).digest('hex'),
    templates: createTemplateStore(),
  };
}
