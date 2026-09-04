// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as channelContentConfigModule from '@tloncorp/api/client/channelContentConfig';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
import { createHash } from 'crypto';

import type {
  ObservationBudget,
  SurfaceCreateChannelPoke,
  SurfaceDeps,
  SurfaceGroupChannel,
  SurfacePostRecord,
  SurfaceRecordKind,
  SurfaceStoragePreflight,
  SurfaceTemplateDetail,
  SurfaceTemplateStore,
  SurfaceTemplateSummary,
  SurfaceValidation,
} from './commands/surface-common';
import { formatSurfaceLintResult, lintSurfaceBundle } from './surface-lint';
import type { SurfaceWriteScope } from './surface-write-scope';

/**
 * A fake ship for the `surface *` command tests.
 *
 * What is faked and what is not is the whole point. The two agents, their
 * disagreements, the poke/observe gap and the storage backend are faked —
 * they are the environment. The wire format is NOT: the spec schema, the
 * entry schemas, the pointer grammar, the reducer and the publish gate are
 * wired to the real implementations through the same package subpaths the
 * runtime uses. A test that folded through a hand-written reducer would
 * prove the command talks to itself.
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
const {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  StructuredChannelDescriptionPayload: SCDP,
} = channelContentConfigModule as Pick<
  ApiModule,
  | 'CollectionRendererId'
  | 'DraftInputId'
  | 'PostContentRendererId'
  | 'StructuredChannelDescriptionPayload'
>;

const ENTRY_SCHEMAS = {
  event: SurfaceEventEntrySchema,
  snapshot: SurfaceSnapshotEntrySchema,
  spec: SurfaceSpecMirrorEntrySchema,
} as const;

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
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: (result.error.issues ?? []).map((issue) => issue.message),
  };
}

/* ------------------------------------------------------------------ */
/* Fake ship                                                           */
/* ------------------------------------------------------------------ */

export interface FakeGroup {
  admins: string[];
  seats: Record<string, { roles?: string[] }>;
  channels: Record<string, SurfaceGroupChannel>;
}

export interface FakePost extends SurfacePostRecord {
  kind: string;
}

/**
 * What a create poke actually reaches. `%channels` acking a poke that
 * `%channels-server` never relayed on is the D50 failure, and it is only
 * testable if the fake can be told to do exactly that.
 */
export type CreateEffect = 'both' | 'channels-only' | 'groups-only' | 'none';

export interface FakeShipOptions {
  ship?: string;
  budget?: ObservationBudget;
  /** the operator's write fence, when a test wants one; unfenced by default */
  writeScope?: SurfaceWriteScope | null;
  createEffect?: CreateEffect;
  /** how many observation polls pass before the create lands */
  createDelayPolls?: number;
  /**
   * A concurrent creator that takes the name between the pre-flight presence
   * check and this command's poke. The winner's channel appears in both
   * agents, `ca-create` then no-ops on ours, and every poke still resolves —
   * the race the title predicate was invented to catch and cannot.
   *
   * `title` defaults to the title OUR poke carried, which is the case that
   * matters: a racer who picked a different title is refutable, a racer who
   * picked the same one is not. `addedBeforeBaseline` backdates the winner's
   * host stamp to the newest one the command read at pre-flight, standing in
   * for the other race — a listing that was already there and that this
   * ship's copy of `%groups` had not caught up with.
   */
  raceCreate?: { title?: string; addedBeforeBaseline?: boolean };
  storage?: SurfaceStoragePreflight | null;
  uploadUrlFor?: (fileName: string) => string;
  uploadThrows?: Error;
  /**
   * Somebody else writing to the ship WHILE this command is uploading.
   *
   * The upload is the only place a surface command spends real time between
   * reading a channel and writing it back — publish and fork both gate,
   * upload, assemble records, and only then rewrite the description cell —
   * so it is where a concurrent admin lands in practice, and it is the one
   * seam a test needs to put them there. Nothing else in the double can:
   * every other hook fires either side of the window, and a test that
   * mutated the channel before the command started would be testing the
   * check, not the gap after it.
   *
   * It runs before `uploadThrows`, because the world moves whether or not
   * this ship's upload succeeds.
   */
  onUploadBundle?: (ship: FakeShip) => void;
  /** drop the kind tail on edit, reproducing the `%edit` hazard */
  editDropsKindTail?: boolean;
  /** silently ignore the description write, so nothing is observable */
  swallowDescriptionWrite?: boolean;
  /**
   * Store something other than what was written — a concurrent metadata
   * edit rebuilding the description from a stale payload, which is D59's
   * unreported consequence: the write lands, and the cell ends up holding
   * a superseded definition.
   */
  rewriteDescriptionOnWrite?: (incoming: string, stored: string) => string;
  pageSize?: number;
}

export class FakeShip {
  readonly ship: string;
  readonly groups = new Map<string, FakeGroup>();
  readonly nests = new Map<string, { perms?: { group?: string } }>();
  readonly posts = new Map<string, FakePost[]>();
  readonly uploads: { fileName: string; bytes: Uint8Array }[] = [];
  readonly files = new Map<string, string>();
  /**
   * The bucket, as a URL → bytes map, kept SEPARATE from the spec that
   * points at it.
   *
   * That separation is the whole point: real storage can serve bytes that
   * do not hash to what a channel's definition pins, and a double that
   * derived the served bytes from the spec could not express that case at
   * all — the tamper test would be asserting against a fixture that cannot
   * be wrong. `serveAsset` writes here; `tamperAsset` overwrites a key the
   * way a second PUT does.
   */
  readonly assets = new Map<string, string>();
  readonly createPokes: SurfaceCreateChannelPoke[] = [];
  readonly descriptionWrites: {
    groupId: string;
    channelId: string;
    description: string;
  }[] = [];
  readonly sleeps: number[] = [];

  private clock = 1_700_000_000_000;
  private postCounter = 0;
  private slugCounter = 0;
  private pendingCreates: { at: number; apply: () => void }[] = [];
  private polls = 0;
  /**
   * The GROUP HOST's clock, which is what stamps `added` on a listing.
   *
   * `%groups` overwrites whatever a create poke carried with its own `now`
   * (`se-c-channel`: `=. added.chan now.bowl`), keeps it across later edits,
   * and every subscriber stores the host's value verbatim — so the stamps a
   * ship can read for one group all come from one strictly-advancing clock.
   * The double advances it the same way. A fixed `added` (this was `1` for
   * every channel) would let a create "confirm" itself against a number
   * nothing ever moves, which is a check that cannot fail.
   */
  private addedClock = 0;
  private raced = false;

  constructor(readonly options: FakeShipOptions = {}) {
    this.ship = options.ship ?? '~zod';
  }

  now(): number {
    this.clock += 1;
    return this.clock;
  }

  nextSlug(): string {
    this.slugCounter += 1;
    return `dash-${this.slugCounter.toString().padStart(4, '0')}`;
  }

  /** The stamp a group add gets. Strictly increasing, like `now.bowl`. */
  nextAdded(): number {
    this.addedClock += 1;
    return this.addedClock;
  }

  /** The newest stamp a group's listing currently holds. */
  newestAdded(groupId: string): number {
    return Object.values(this.groups.get(groupId)?.channels ?? {}).reduce(
      (newest, channel) => (channel.added > newest ? channel.added : newest),
      0
    );
  }

  addGroup(
    groupId: string,
    group: Partial<FakeGroup> & { admins?: string[] } = {}
  ): FakeGroup {
    const record: FakeGroup = {
      admins: group.admins ?? ['admin'],
      seats: group.seats ?? { [this.ship]: { roles: ['admin'] } },
      channels: group.channels ?? {},
    };
    this.groups.set(groupId, record);
    return record;
  }

  addChannel(
    groupId: string,
    channelId: string,
    description = ''
  ): SurfaceGroupChannel {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`no fake group ${groupId}`);
    const channel: SurfaceGroupChannel = {
      added: this.nextAdded(),
      meta: { title: 'Dashboard', description, image: '', cover: '' },
      section: 'default',
      readers: [],
      join: true,
    };
    group.channels[channelId] = channel;
    this.nests.set(channelId, { perms: { group: groupId } });
    return channel;
  }

  /** The half-created state: `%channels` holds it, `%groups` never did. */
  burnName(channelId: string): void {
    const host = channelId.split('/')[1];
    this.nests.set(channelId, { perms: { group: `${host}/` } });
  }

  setChannelSpec(channelId: string, spec: unknown): void {
    for (const group of this.groups.values()) {
      const channel = group.channels[channelId];
      if (!channel) continue;
      const decoded = SCDP.decode(channel.meta.description);
      channel.meta.description =
        SCDP.encode({ ...decoded, surfaceSpec: spec as never }) ?? '';
      return;
    }
    throw new Error(`no fake channel ${channelId}`);
  }

  /** Puts bytes at a storage URL, and returns the URL. */
  serveAsset(url: string, content: string): string {
    this.assets.set(url, content);
    return url;
  }

  /**
   * Replaces the bytes at a URL that is already serving something.
   *
   * The modelled threat, verbatim (the dev store's own note says the same):
   * whoever holds the bucket can change what is at a key, and cannot thereby
   * change what a client will run. It throws on an unserved key so a test
   * cannot "tamper" with storage that was never holding the original — that
   * would be two arms differing in whether the file exists rather than in
   * what it contains.
   */
  tamperAsset(url: string, content: string): void {
    if (!this.assets.has(url)) {
      throw new Error(`nothing is served at ${url} to tamper with`);
    }
    this.assets.set(url, content);
  }

  channelSpecText(channelId: string): string | null {
    for (const group of this.groups.values()) {
      const channel = group.channels[channelId];
      if (channel) {
        return SCDP.rawPersistenceFields(channel.meta.description).surfaceSpec;
      }
    }
    return null;
  }

  addPost(
    channelId: string,
    post: Partial<FakePost> & { blob?: string }
  ): FakePost {
    const list = this.posts.get(channelId) ?? [];
    this.postCounter += 1;
    // `%channels-server` stamps sequence numbers in order, so the next one is
    // above every sequence the channel already holds — not the list length,
    // which a test that injects a high sequence would make go BACKWARDS. A
    // sequence that can go backwards is not the ship's; it is a number the
    // double made up, and a writer confirming itself against it would be
    // confirming itself against nothing.
    const highest = list.reduce(
      (seq, entry) =>
        typeof entry.sequenceNum === 'number' && entry.sequenceNum > seq
          ? entry.sequenceNum
          : seq,
      0
    );
    const record: FakePost = {
      id: post.id ?? `post-${this.postCounter}`,
      authorId: post.authorId ?? this.ship,
      sentAt: post.sentAt ?? this.now(),
      sequenceNum: post.sequenceNum ?? highest + 1,
      isEdited: post.isEdited ?? false,
      isDeleted: post.isDeleted ?? false,
      blob: post.blob ?? null,
      kind: post.kind ?? '/chat',
    };
    list.push(record);
    this.posts.set(channelId, list);
    return record;
  }

  /** Called once per observation poll, so a delayed create can land. */
  private tick(): void {
    this.polls += 1;
    const ready = this.pendingCreates.filter((entry) => entry.at <= this.polls);
    this.pendingCreates = this.pendingCreates.filter(
      (entry) => entry.at > this.polls
    );
    for (const entry of ready) entry.apply();
  }

  /**
   * A concurrent creator taking the name in the gap between the pre-flight
   * presence check and this poke's effect.
   *
   * It lands FIRST, so the poke that follows meets a name `%channels`
   * already holds and no-ops exactly as `ca-create` does. `%groups` stamps
   * the winner's listing with its own clock, so by default the winner's
   * `added` is NEWER than anything the command saw at pre-flight — the race
   * no baseline can refute. `addedBeforeBaseline` puts it exactly ON the
   * newest stamp the command read instead, which is the other race: a
   * listing that already existed and that this ship had not yet caught up
   * with. Equal rather than lower on purpose — `now.bowl` advances between
   * events, so a listing sharing a stamp we already saw was written by an
   * event we already saw, and a check written `>=` would call it ours.
   */
  private applyRace(
    poke: SurfaceCreateChannelPoke,
    race: { title?: string; addedBeforeBaseline?: boolean }
  ): void {
    if (!this.groups.has(poke.group)) return;
    const baseline = this.newestAdded(poke.group);
    const channel = this.addChannel(poke.group, poke.id);
    channel.meta.title = race.title ?? poke.title;
    if (race.addedBeforeBaseline) channel.added = baseline;
  }

  applyCreate(poke: SurfaceCreateChannelPoke): void {
    this.createPokes.push(poke);
    const race = this.options.raceCreate;
    if (race && !this.raced) {
      this.raced = true;
      this.applyRace(poke, race);
    }
    const effect = this.options.createEffect ?? 'both';
    const delay = this.options.createDelayPolls ?? 0;
    const apply = () => {
      // D50, in the double: `ca-create` under a name `%channels` already
      // holds is a SILENT no-op, and the poke still resolves. Nothing about
      // the existing channel changes — not its title, not its description —
      // so a create that lands on a taken name leaves the ship exactly as
      // it found it while reporting nothing at all.
      if (this.nests.has(poke.id)) return;
      if (effect === 'both' || effect === 'channels-only') {
        this.nests.set(poke.id, {
          perms: { group: effect === 'both' ? poke.group : `${this.ship}/` },
        });
      }
      if (effect === 'both' || effect === 'groups-only') {
        const group = this.groups.get(poke.group);
        if (group) {
          group.channels[poke.id] = {
            added: this.nextAdded(),
            meta: {
              title: poke.title,
              description: poke.description,
              image: '',
              cover: '',
            },
            section: 'default',
            readers: poke.readers,
            join: true,
          };
        }
      }
    };
    if (delay > 0) {
      this.pendingCreates.push({ at: this.polls + delay, apply });
    } else {
      apply();
    }
  }

  readNests(): Record<string, { perms?: { group?: string } }> {
    this.tick();
    return Object.fromEntries(this.nests);
  }

  readGroupChannels(
    groupId: string
  ): Record<string, SurfaceGroupChannel> | null {
    const group = this.groups.get(groupId);
    return group ? { ...group.channels } : null;
  }
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export function fakeTemplateStore(
  templates: SurfaceTemplateDetail[] | null,
  root = '/fake/templates'
): SurfaceTemplateStore {
  return {
    root: () => root,
    exists: () => templates !== null,
    list: (): SurfaceTemplateSummary[] =>
      (templates ?? []).map(({ name, title, files, bundleAbsence }) => ({
        name,
        title,
        files,
        bundleAbsence,
      })),
    read: (name) => (templates ?? []).find((t) => t.name === name) ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Deps                                                                */
/* ------------------------------------------------------------------ */

export interface TestSurfaceDeps {
  deps: SurfaceDeps;
  ship: FakeShip;
  stdout: string[];
  stderr: string[];
  out(): string;
  err(): string;
  json(): Record<string, unknown>;
}

export function createTestSurfaceDeps(
  options: FakeShipOptions & {
    ship?: string;
    templates?: SurfaceTemplateDetail[] | null;
    overrides?: Partial<SurfaceDeps>;
  } = {}
): TestSurfaceDeps {
  const ship = new FakeShip(options);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const pageSize = options.pageSize ?? 200;

  const deps: SurfaceDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {},
    actingShip: () => ship.ship,
    // Unfenced by default: the fence is an operator's bound on one process, so
    // a test that wants one sets it explicitly (see surface-write-scope.test.ts).
    writeScope: options.writeScope ?? null,
    observationBudget: options.budget ?? TEST_BUDGET,
    normalizeShip: (name) => (name.startsWith('~') ? name : `~${name}`),
    now: () => ship.now(),
    sleep: async (ms) => {
      ship.sleeps.push(ms);
    },
    randomSlug: () => ship.nextSlug(),
    surfaceContentConfiguration: {
      draftInput: DraftInputId.none,
      defaultPostContentRenderer: PostContentRendererId.chat,
      defaultPostCollectionRenderer: CollectionRendererId.surface,
    },

    readGroupAdmin: async (groupId) => {
      const group = ship.groups.get(groupId);
      return group ? { admins: group.admins, seats: group.seats } : null;
    },
    readGroupChannels: async (groupId) => ship.readGroupChannels(groupId),
    readChannelNests: async () => ship.readNests(),
    readPostPage: async ({ channelId, cursor, mode, count }) => {
      const all = [...(ship.posts.get(channelId) ?? [])].sort(
        (left, right) => (right.sequenceNum ?? 0) - (left.sequenceNum ?? 0)
      );
      const start = mode === 'newest' ? 0 : Number(cursor ?? '0');
      const window = Math.min(count, pageSize);
      const slice = all.slice(start, start + window);
      const nextStart = start + slice.length;
      return {
        posts: slice.map(({ kind: _kind, ...post }) => post),
        older: nextStart < all.length ? String(nextStart) : null,
        totalPosts: all.length,
      };
    },
    readPostKind: async (channelId, postId) =>
      (ship.posts.get(channelId) ?? []).find((post) => post.id === postId)
        ?.kind ?? null,

    createChannel: async (input) => {
      ship.applyCreate(input);
    },
    writeGroupChannel: async ({ groupId, channelId, channel }) => {
      ship.descriptionWrites.push({
        groupId,
        channelId,
        description: channel.meta.description,
      });
      if (options.swallowDescriptionWrite) return;
      const group = ship.groups.get(groupId);
      if (group?.channels[channelId]) {
        const stored = options.rewriteDescriptionOnWrite
          ? options.rewriteDescriptionOnWrite(
              channel.meta.description,
              group.channels[channelId].meta.description
            )
          : channel.meta.description;
        group.channels[channelId] = {
          ...channel,
          meta: { ...channel.meta, description: stored },
        };
      }
    },
    sendSurfacePost: async ({ channelId, kindTail, blob, sentAt }) => {
      ship.addPost(channelId, {
        blob,
        sentAt,
        authorId: ship.ship,
        kind: `/chat/${kindTail}`,
      });
    },
    editSurfacePost: async ({ channelId, postId, kindTail, blob }) => {
      const post = (ship.posts.get(channelId) ?? []).find(
        (entry) => entry.id === postId
      );
      if (!post) return;
      post.isEdited = true;
      post.blob = blob ?? null;
      post.kind = options.editDropsKindTail ? '/chat' : `/chat/${kindTail}`;
    },

    storagePreflight: async () =>
      options.storage === undefined ? { canStore: true } : options.storage,
    uploadBundle: async ({ fileName, bytes }) => {
      options.onUploadBundle?.(ship);
      if (options.uploadThrows) throw options.uploadThrows;
      ship.uploads.push({ fileName, bytes });
      const url = options.uploadUrlFor
        ? options.uploadUrlFor(fileName)
        : `https://storage.example/${fileName}`;
      return { url };
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

    // Storage, serving whatever `ship.assets` currently holds — which is not
    // required to agree with the spec that points at it. A double that
    // rebuilt the bytes from the spec could never express the tampered case,
    // and a verification test whose double cannot express the defect is
    // bounded by the double rather than by the code.
    //
    // It deliberately does NOT enforce `maxBytes`. A hostile bucket does not
    // enforce it either — that is the whole point of the cap — so a double
    // that refused an over-cap body here would be standing in for the
    // caller's check and would make the caller's check untestable.
    fetchAsset: async ({ url }) => {
      const content = ship.assets.get(url);
      if (content === undefined) {
        return {
          ok: false,
          reason: 'fetch-failed',
          detail: `nothing is served at ${url}`,
        };
      }
      return { ok: true, bytes: new TextEncoder().encode(content) };
    },
    readTextFile: (filePath) => {
      const text = ship.files.get(filePath);
      if (text === undefined) throw new Error(`ENOENT: ${filePath}`);
      return text;
    },
    readBinaryFile: (filePath) => {
      const text = ship.files.get(filePath);
      if (text === undefined) throw new Error(`ENOENT: ${filePath}`);
      return new TextEncoder().encode(text);
    },
    writeBinaryFile: (filePath, bytes) => {
      ship.files.set(filePath, new TextDecoder().decode(bytes));
    },
    sha256Hex: (bytes) => createHash('sha256').update(bytes).digest('hex'),
    templates: fakeTemplateStore(
      options.templates === undefined ? [] : options.templates
    ),
    ...options.overrides,
  };

  return {
    deps,
    ship,
    stdout,
    stderr,
    out: () => stdout.join(''),
    err: () => stderr.join(''),
    json: () => JSON.parse(stdout.join('').trim().split('\n').pop() ?? '{}'),
  };
}

/** A fast observation budget, so a refusal test does not sleep 40 times. */
export const TEST_BUDGET = { attempts: 3, intervalMs: 0 };
