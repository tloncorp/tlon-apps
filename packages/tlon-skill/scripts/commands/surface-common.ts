import type {
  SurfaceReduction,
  SurfaceSpec,
  SurfaceSpecReadResult,
} from '@tloncorp/api';

import type { SurfaceLintResult } from '../surface-lint';
import type { SurfaceWriteScope } from '../surface-write-scope';
import { CommandError, type CommandDeps, writeLine } from './command';

/**
 * Shared vocabulary for the `surface *` command group: the injected
 * dependency surface, the machine-readable error type, and the pure helpers
 * every subcommand needs.
 *
 * Two properties drive everything in this file.
 *
 * **Success is observed, never assumed.** `%channels`' local agent acks a
 * poke that `%channels-server` went on to reject or silently no-op (D50), so
 * no writer here treats a resolved poke as a result. Every write is followed
 * by a read of the thing written, and the command reports what it read.
 * `observeUntil` is the only shape a confirmation takes.
 *
 * **Errors are two things at once.** A bot's self-repair loop needs a stable
 * code it can branch on; the human it is talking to needs a sentence. Every
 * failure is a `SurfaceError` carrying both, plus structured `details` — so
 * `--json` emits something a program consumes and the default output stays
 * a plain-language line.
 */

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * The stable failure vocabulary. Codes are the branch points of a repair
 * loop, so they name the *situation* rather than the call that failed:
 * `admin-required` tells a bot to ask for a role, `storage-unavailable`
 * tells it to ask for a bucket, and the two are never the same remedy.
 */
export const SURFACE_ERROR_CODES = [
  'usage',
  'group-not-found',
  'admin-required',
  'storage-unavailable',
  'storage-no-bucket',
  'name-taken',
  'name-burned',
  'create-unconfirmed',
  'channel-not-found',
  'spec-absent',
  'spec-invalid',
  'spec-version-too-new',
  'spec-file-invalid',
  'surface-id-changed',
  'initial-state-changed',
  'lint-failed',
  'upload-failed',
  'publish-unconfirmed',
  'post-unconfirmed',
  'kind-tail-lost',
  'post-not-found',
  'migration-pending',
  'partial-hydration',
  'invalid-ops',
  'state-too-large',
  'template-not-found',
  'template-catalogue-empty',
  'template-bundle-missing',
  'doctrine-unavailable',
  'bundle-unavailable',
  'rubric-unreadable',
  'rubric-incomplete',
  'rubric-mismatch',
  'current-definition-unreadable',
  'write-out-of-scope',
  'pre-state-moved',
  'fork-destination-occupied',
  'recipe-absent',
  'gate-harness-unavailable',
  'snapshot-head-exceeded',
  'write-target-moved',
] as const;

export type SurfaceErrorCode = (typeof SURFACE_ERROR_CODES)[number];

/**
 * Which kind of thing went wrong, and therefore who can fix it.
 *
 * - `author` — the files or arguments this command was handed are wrong. The
 *   caller owns them, so the remedy is to change them and run again.
 * - `environment` — the system refused, or the channel is in a state this
 *   command cannot act on. The caller's files are FINE; retrying them
 *   unchanged repeats the refusal, and rewriting them is destructive noise.
 */
export type SurfaceErrorClass = 'author' | 'environment';

/**
 * The class of every code, kept beside the codes so the two cannot drift.
 *
 * This exists because a misclassified code is not a cosmetic problem: the
 * skill's doctrine tells a bot that an author-error code means "your files
 * are wrong, fix and retry", so a system-level refusal wearing an
 * author-error code sends the bot to rewrite a perfectly good app and
 * republish over a channel that needs repairing, not regenerating. That is
 * exactly what an oversized migration snapshot did while it reported
 * `invalid-ops`.
 *
 * Declared as a total `Record` so a new code cannot be added without a class
 * — the type checker refuses the omission, and `surface-common.test.ts`
 * refuses it again at runtime, where the CLI's own tests actually run.
 *
 * `spec-invalid` is `author` at both its call sites: assembling an invalid
 * definition is the caller's file, and a channel holding an unreadable one is
 * repaired by republishing — which is still the caller's file.
 */
export const SURFACE_ERROR_CLASS: Record<SurfaceErrorCode, SurfaceErrorClass> =
  {
    usage: 'author',
    'group-not-found': 'environment',
    'admin-required': 'environment',
    'storage-unavailable': 'environment',
    'storage-no-bucket': 'environment',
    'name-taken': 'environment',
    'name-burned': 'environment',
    'create-unconfirmed': 'environment',
    'channel-not-found': 'environment',
    'spec-absent': 'environment',
    'spec-invalid': 'author',
    'spec-version-too-new': 'environment',
    'spec-file-invalid': 'author',
    'surface-id-changed': 'author',
    // The spec file declares a starting state a preserving revision will not
    // apply. The caller owns that file and owns the command line, and both
    // remedies are theirs — carry the change in as a host event, or publish
    // without `--preserve-state` — so this is `author` for the same reason
    // `surface-id-changed` is.
    'initial-state-changed': 'author',
    'lint-failed': 'author',
    // The GATE could not run — its own known-good canary bundle failed to
    // render, so nothing the behavioral phase would have said about the
    // caller's app is a fact about the caller's app. Author-classing this
    // would tell a bot to rewrite files that are fine, which is the exact
    // destructive-noise failure `environment` exists to prevent.
    'gate-harness-unavailable': 'environment',
    // The channel holds a snapshot claiming coverage beyond its own head.
    // Nothing in the caller's working directory is implicated and no rewrite
    // of it helps: the repair is retracting a post that is already on the
    // ship.
    'snapshot-head-exceeded': 'environment',
    // Somebody else wrote to the target between this command's check and its
    // write. The caller's files are correct and unchanged — running the same
    // command again over the new pre-state is the remedy — so this is
    // `environment` for the same reason `pre-state-moved` is.
    'write-target-moved': 'environment',
    'upload-failed': 'environment',
    'publish-unconfirmed': 'environment',
    'post-unconfirmed': 'environment',
    'kind-tail-lost': 'environment',
    'post-not-found': 'environment',
    'migration-pending': 'environment',
    'partial-hydration': 'environment',
    'invalid-ops': 'author',
    'state-too-large': 'environment',
    'template-not-found': 'author',
    'template-catalogue-empty': 'environment',
    // The INSTALL ships a template directory with no app bundle in it. The
    // caller's own files are not implicated and no rewrite of them produces
    // the missing file, so this is `environment` for the same reason
    // `template-catalogue-empty` is.
    'template-bundle-missing': 'environment',
    // The install does not carry the document the bot asked for: its own
    // files are irrelevant to the failure, and no rewrite of them fixes it.
    'doctrine-unavailable': 'environment',
    // The bytes a channel's definition points at cannot be had, or cannot be
    // trusted. Nothing in the caller's working directory is implicated — the
    // pointer and the hash were written by an earlier publish, and the
    // storage holding them belongs to somebody else — so regenerating an app
    // in response is exactly the destructive noise `environment` exists to
    // prevent.
    'bundle-unavailable': 'environment',
    // All three rubric refusals are `author`: the scoring sheet is a file the
    // caller wrote, and the remedy is always to change that file (or the work
    // behind it) and run again. `rubric-mismatch` is the one worth naming —
    // it means the sheet is complete but scores different bytes, so the repair
    // is re-running preview and re-scoring, not editing the hash.
    'rubric-unreadable': 'author',
    'rubric-incomplete': 'author',
    'rubric-mismatch': 'author',
    // The CHANNEL holds something unreadable. Nothing in the caller's working
    // directory caused it and no rewrite of the app fixes it — regenerating in
    // response is precisely the destructive noise `environment` exists to
    // prevent, and in this case it would land someone else's app on a live
    // board.
    'current-definition-unreadable': 'environment',
    // The operator pointed this process somewhere and it went somewhere else.
    // Nothing about the app or the caller's files is wrong, and rewriting
    // either fixes nothing — the target is the thing that has to change, and
    // only whoever set the fence can decide how.
    'write-out-of-scope': 'environment',
    'pre-state-moved': 'environment',
    // The channel a fork was aimed at already publishes an app. Nothing the
    // caller is holding is wrong — the source and its bundle are fine — and no
    // rewrite of either helps, because the thing that has to change is the
    // target. Landing a fork on a published board would orphan every event
    // under it at a revision restarting from 1: the wrong-board incident with
    // a copy in place of a revision.
    'fork-destination-occupied': 'environment',
    // `--regenerate` forks from the source's recorded intent, and this source
    // recorded none. The caller's files are not implicated — the missing
    // recipe belongs to a publish somebody else ran — so the remedy is to fork
    // the bytes instead, not to rewrite anything here.
    'recipe-absent': 'environment',
  };

export class SurfaceError extends CommandError {
  readonly code: SurfaceErrorCode;
  readonly errorClass: SurfaceErrorClass;
  readonly details: Record<string, unknown>;

  constructor(
    code: SurfaceErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message, 1);
    this.name = 'SurfaceError';
    this.code = code;
    this.errorClass = SURFACE_ERROR_CLASS[code];
    this.details = details;
  }
}

/**
 * The class rides in `details` rather than beside `code`, so every `--json`
 * failure document carries it without the dispatcher having to learn a new
 * field. It is written last: the classification of a code is not something a
 * call site gets to override.
 */
export function surfaceError(
  code: SurfaceErrorCode,
  message: string,
  details: Record<string, unknown> = {}
): SurfaceError {
  return new SurfaceError(code, message, {
    ...details,
    errorClass: SURFACE_ERROR_CLASS[code],
  });
}

/* ------------------------------------------------------------------ */
/* Ship-facing shapes                                                  */
/* ------------------------------------------------------------------ */

/** `GroupMeta` as `%groups` holds it. `description` carries the payload. */
export interface SurfaceChannelMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

/** `GroupChannelV7` — the whole listing, so an edit rewrites nothing else. */
export interface SurfaceGroupChannel {
  added: number;
  meta: SurfaceChannelMeta;
  section: string;
  readers: string[];
  join: boolean;
}

/** The slice of `/v2/ui/groups/<flag>` the admin check reads. */
export interface SurfaceAdminView {
  admins?: string[];
  seats?: Record<string, { roles?: string[] }>;
}

/** An entry of `%channels`' `/v3/channels` map. */
export interface SurfaceNestEntry {
  perms?: { group?: string; writers?: string[] };
}

/**
 * The slice of the client post model the surface commands read. A superset
 * of the reducer's `SurfacePostView` — `id` and `sentAt` are what let a
 * writer find the post it just wrote, since the id is host-stamped (D53)
 * and therefore unpredictable at write time.
 */
export interface SurfacePostRecord {
  id: string;
  authorId: string;
  sentAt: number;
  sequenceNum?: number | null;
  isEdited?: boolean | null;
  isDeleted?: boolean | null;
  blob?: string | null;
}

export const SURFACE_KIND_TAILS = {
  spec: 'surface/spec',
  event: 'surface/event',
  snapshot: 'surface/snapshot',
} as const;

export type SurfaceRecordKind = keyof typeof SURFACE_KIND_TAILS;
export type SurfaceKindTail = (typeof SURFACE_KIND_TAILS)[SurfaceRecordKind];

/** The full wire kind a surface post must carry, for the read-back check. */
export function surfaceWireKind(kind: SurfaceRecordKind): string {
  return `/chat/${SURFACE_KIND_TAILS[kind]}`;
}

export type SurfaceStoragePreflight =
  | { canStore: true }
  | { canStore: false; reason: 'no-bucket' | 'no-storage' };

export type SurfaceValidation =
  | { ok: true }
  | { ok: false; issues: readonly string[] };

/**
 * The result of asking storage for a bundle's bytes.
 *
 * Total rather than throwing, and the failure reasons are the ones the
 * CLIENT already distinguishes (`bundleCache.ts`'s `BundleResult`): a
 * transport failure and an over-cap body are different facts about the
 * bucket, and a caller that only learns "it did not work" cannot say which.
 *
 * `hash-mismatch` is deliberately NOT in this union. Whether bytes match the
 * hash is not something transport gets an opinion about — it is the one
 * judgement the caller makes for itself, over the bytes it was handed.
 */
export type SurfaceAssetFetch =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'fetch-failed' | 'oversize'; detail: string };

export interface SurfaceTemplateSummary {
  name: string;
  title: string | null;
  /** absolute paths of the files the template actually ships */
  files: { bundle: string | null; spec: string | null; notes: string | null };
  /**
   * Why `files.bundle` is null, when it is — the names that were looked for
   * and what the directory actually holds. Null whenever a bundle WAS found.
   *
   * It exists so a failed bundle lookup can be REPORTED rather than
   * substituted for. The lookup used to fall through to
   * `readdirSync(dir).filter(.js)[0]` — an arbitrary file, chosen by
   * filesystem enumeration order, handed to a bot as the template's bundle
   * under a zero exit code. Carrying the absence here lets the command that
   * consumes it name the template, the expected names and the found ones
   * without reaching for the filesystem itself.
   */
  bundleAbsence: {
    expected: readonly string[];
    found: readonly string[];
  } | null;
}

export interface SurfaceTemplateDetail extends SurfaceTemplateSummary {
  spec: unknown;
  specText: string | null;
  notes: string | null;
  bundleBytes: number | null;
}

export interface SurfaceTemplateStore {
  /** absolute path of the catalogue root, whether or not it exists */
  root(): string;
  exists(): boolean;
  list(): SurfaceTemplateSummary[];
  read(name: string): SurfaceTemplateDetail | null;
}

/* ------------------------------------------------------------------ */
/* Dependencies                                                        */
/* ------------------------------------------------------------------ */

export interface SurfaceCreateChannelPoke {
  id: string;
  kind: 'chat';
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface SurfacePostPage {
  posts: SurfacePostRecord[];
  older: string | null;
  totalPosts: number;
}

/**
 * Everything a surface command touches that is not pure computation.
 *
 * The validators and the reducer are injected rather than imported so this
 * module carries no `@tloncorp/api` value import (the `commands/` contract),
 * but the intent is stronger than the contract: there is exactly ONE
 * implementation of the spec schema, the entry schemas, the pointer grammar
 * and the fold, and the CLI runs the same one the client runs. A
 * reimplementation here would be a second definition of the wire format,
 * which is the thing the shared-implementation rule exists to prevent.
 */
export interface SurfaceDeps extends CommandDeps {
  authenticate(): Promise<void>;
  actingShip(): string;
  /**
   * The operator's write fence, or null when this process is unfenced.
   *
   * Resolved once when the runtime is built, not per command: a fence that
   * could change under a running command would be a fence with a race in it.
   */
  writeScope: SurfaceWriteScope | null;
  /** how patiently every write waits to observe itself */
  observationBudget: ObservationBudget;
  normalizeShip(ship: string): string;
  now(): number;
  sleep(ms: number): Promise<void>;
  randomSlug(): string;
  /**
   * `ChannelContentConfiguration` for a surface channel — the surface
   * collection renderer and no composer. Injected rather than spelled out
   * here so the renderer ids have exactly one definition, in
   * `@tloncorp/api`'s `channelContentConfig`.
   */
  surfaceContentConfiguration: Record<string, unknown>;

  readGroupAdmin(groupId: string): Promise<SurfaceAdminView | null>;
  readGroupChannels(
    groupId: string
  ): Promise<Record<string, SurfaceGroupChannel> | null>;
  readChannelNests(): Promise<Record<string, SurfaceNestEntry>>;
  readPostPage(input: {
    channelId: string;
    cursor?: string;
    mode: 'newest' | 'older';
    count: number;
  }): Promise<SurfacePostPage>;
  /** the raw `essay.kind` of a post, straight from `%channels` */
  readPostKind(channelId: string, postId: string): Promise<string | null>;

  createChannel(input: SurfaceCreateChannelPoke): Promise<void>;
  writeGroupChannel(input: {
    groupId: string;
    channelId: string;
    channel: SurfaceGroupChannel;
  }): Promise<void>;
  sendSurfacePost(input: {
    channelId: string;
    kindTail: SurfaceKindTail;
    fallback: string;
    blob: string;
    sentAt: number;
  }): Promise<void>;
  editSurfacePost(input: {
    channelId: string;
    postId: string;
    kindTail: SurfaceKindTail;
    fallback: string;
    blob?: string;
    sentAt: number;
  }): Promise<void>;

  storagePreflight(): Promise<SurfaceStoragePreflight | null>;
  /**
   * Stores bundle bytes and returns the URL clients will fetch them from.
   *
   * `fileName` is the bundle's own hash, so the stored object is named by
   * its content. It is NOT a content-addressed key in the strict sense —
   * `uploadFile` stamps `Date.now()` into every storage key, so the same
   * bytes uploaded twice land at two URLs. Publish therefore never
   * re-uploads unchanged bytes, which is what makes an unchanged bundle
   * keep an unchanged `assetRef` (and so a byte-identical republish a real
   * no-op). See the report note on plan §9.
   */
  uploadBundle(input: {
    fileName: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ url: string }>;

  /** `StructuredChannelDescriptionPayload`, injected verbatim */
  description: {
    decode(encoded: string | null | undefined): Record<string, unknown>;
    encode(payload: Record<string, unknown>): string;
    rawSurfaceSpec(encoded: string | null | undefined): string | null;
  };
  /** `readSurfaceSpec` — the four-way read of a persisted spec */
  readSpecText(raw: string | null | undefined): SurfaceSpecReadResult;
  /** `SurfaceSpecSchema.safeParse` over an already-parsed value */
  validateSpecValue(value: unknown): SurfaceValidation;
  /** the blob-entry schemas, by record kind */
  validateEntry(kind: SurfaceRecordKind, value: unknown): SurfaceValidation;
  /** `parsePointer` — the restricted RFC 6901 grammar */
  parsePointer(
    path: string
  ): { ok: true; segments: string[] } | { ok: false; error: string };
  /** `reduceSurface` — the shared fold */
  reduce(input: {
    spec: SurfaceSpec;
    hostShip: string;
    posts: SurfacePostRecord[];
    /**
     * The channel head from `hydratePosts`, so the CLI applies the same D175
     * ceiling the client does.
     *
     * REQUIRED, and required is the fix (D199). It was optional, and three
     * folds in this package that write snapshots from their result quietly
     * did not pass it — so a snapshot claiming coverage beyond the real head
     * was folded, and its state re-emitted under an honest-looking boundary
     * that every client accepts. An optional ceiling is a ceiling that gets
     * left off exactly where the consequence is worst.
     *
     * `null` is the way to say "there is no head here" — a synthetic post set
     * has no ship — and saying it is a visible decision at the call site
     * rather than a field nobody typed.
     */
    advertisedHead: number | null;
  }): SurfaceReduction;
  /** `SURFACE_CAPS`, for pre-flight refusals with a number in them */
  caps: { opsPerEvent: number; bundleSize: number };
  /** `lintSurfaceBundle` — the publish gate */
  lint(input: { bundleSource: string; spec: unknown }): SurfaceLintResult;
  /** `formatSurfaceLintResult` — the gate's own rendering, not a copy */
  formatLint(result: SurfaceLintResult): string;

  /**
   * Reads a bundle back out of storage.
   *
   * Injected for the same reason `uploadBundle` is: storage is environment.
   * It is a plain GET and nothing more — no hashing, no caching, no
   * judgement about what came back. `maxBytes` lets the transport
   * short-circuit an over-cap body on its declared length before buffering
   * it, which is the one protection that cannot live in the caller.
   */
  fetchAsset(input: {
    url: string;
    maxBytes: number;
  }): Promise<SurfaceAssetFetch>;
  readTextFile(path: string): string;
  readBinaryFile(path: string): Uint8Array;
  writeBinaryFile(path: string, bytes: Uint8Array): void;
  sha256Hex(bytes: Uint8Array): string;
  templates: SurfaceTemplateStore;
}

/* ------------------------------------------------------------------ */
/* Nests                                                               */
/* ------------------------------------------------------------------ */

export interface ParsedNest {
  kind: string;
  host: string;
  name: string;
}

export function parseSurfaceNest(nest: string): ParsedNest {
  const parts = nest.split('/');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw surfaceError(
      'usage',
      `"${nest}" is not a channel id — expected the form chat/~host/name.`,
      { channel: nest }
    );
  }
  return { kind: parts[0], host: parts[1], name: parts[2] };
}

/** The host ship of a channel, which is the only authority for host ops. */
export function channelHostShip(channelId: string): string {
  return parseSurfaceNest(channelId).host;
}

/* ------------------------------------------------------------------ */
/* Writer disciplines                                                  */
/* ------------------------------------------------------------------ */

/**
 * A surface post's blob: exactly one entry, always.
 *
 * The reducer stays permissive about multi-entry posts so a malformed
 * writer cannot make two clients disagree, but that permissiveness is not a
 * licence — it is why the rule has to live in the writer, where it can be
 * tested, rather than being enforced downstream.
 */
export function buildSurfaceBlob(entry: unknown): string {
  return JSON.stringify([entry]);
}

/**
 * Checks a snapshot record BEFORE anything durable moves on its account.
 *
 * `postSurfaceRecord` validates every record it writes, but it does so at the
 * moment of writing — which for a preserving publish is after the definition
 * has already moved. That ordering is what let an unwritable snapshot strand
 * a channel, so the check has to be available to callers that need it earlier.
 *
 * The schema is asked rather than the cap re-read: there is one definition of
 * how big a snapshot may be, and a second copy of the number here would be a
 * second definition of the wire format. The code is `state-too-large` because
 * `state` is the only field of a machine-assembled snapshot record that can
 * fail — every other field is a literal, a spec-derived id, or a validated
 * sequence number — and the schema's own issue text travels in `details` so
 * even the unreachable case cannot mislead.
 */
export function assertSnapshotRecordValid(
  deps: Pick<SurfaceDeps, 'validateEntry'>,
  entry: unknown,
  context: { channel: string; specRevision: number }
): void {
  const validation = deps.validateEntry('snapshot', entry);
  if (validation.ok) return;
  throw surfaceError(
    'state-too-large',
    `${context.channel} holds more state than a snapshot record may carry at revision ${context.specRevision}: ${validation.issues.join('; ')}. Prune it with a host event and try again — the app's files are not the problem.`,
    {
      channel: context.channel,
      specRevision: context.specRevision,
      issues: validation.issues,
    }
  );
}

/* ------------------------------------------------------------------ */
/* Observation                                                         */
/* ------------------------------------------------------------------ */

export type ObservationProbe<T> = () => Promise<
  { done: true; value: T } | { done: false; detail: string }
>;

export type Observation<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; detail: string; attempts: number };

export interface ObservationBudget {
  attempts: number;
  intervalMs: number;
}

export const DEFAULT_OBSERVATION_BUDGET: ObservationBudget = {
  attempts: 40,
  intervalMs: 500,
};

/**
 * Polls a read until it shows the thing a write was supposed to produce.
 *
 * The failure carries the LAST probe's detail rather than a generic
 * timeout, because "the channel is in %channels but %groups never listed
 * it" and "neither agent has it" are different bugs with different
 * remedies, and a caller that only learns "not confirmed" cannot tell them
 * apart.
 */
export async function observeUntil<T>(
  deps: Pick<SurfaceDeps, 'sleep'>,
  budget: ObservationBudget,
  probe: ObservationProbe<T>
): Promise<Observation<T>> {
  let detail = 'nothing was observed';
  for (let attempt = 1; attempt <= budget.attempts; attempt += 1) {
    const result = await probe();
    if (result.done) {
      return { ok: true, value: result.value, attempts: attempt };
    }
    detail = result.detail;
    if (attempt < budget.attempts) {
      await deps.sleep(budget.intervalMs);
    }
  }
  return { ok: false, detail, attempts: budget.attempts };
}

/* ------------------------------------------------------------------ */
/* Argument parsing                                                    */
/* ------------------------------------------------------------------ */

export interface ParsedSurfaceArgs {
  positional: string[];
  /** repeated flags keep every occurrence, in order */
  values: Map<string, string[]>;
  flags: Set<string>;
  /**
   * Every value-bearing occurrence in argv order. Ops are order-sensitive —
   * `--set /a … --del /a` and its reverse are different edits — and a
   * per-flag grouping cannot express that.
   */
  ordered: { flag: string; values: string[] }[];
  help: boolean;
}

export interface FlagSpec {
  /** flags that take one value */
  value?: readonly string[];
  /** flags that take two values (`--set <path> <json>`) */
  pair?: readonly string[];
  /** flags that take no value */
  boolean?: readonly string[];
}

/**
 * A tiny option parser shared by the group. Deliberately strict: an unknown
 * flag is a usage error rather than a silently ignored token, because the
 * caller is frequently a bot assembling an argv it cannot eyeball.
 */
export function parseSurfaceArgs(
  args: string[],
  spec: FlagSpec,
  help: string
): ParsedSurfaceArgs {
  const valueFlags = new Set(spec.value ?? []);
  const pairFlags = new Set(spec.pair ?? []);
  const booleanFlags = new Set(spec.boolean ?? []);
  const positional: string[] = [];
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const ordered: { flag: string; values: string[] }[] = [];

  const record = (flag: string, taken: string[]) => {
    values.set(flag, [...(values.get(flag) ?? []), ...taken]);
    ordered.push({ flag, values: taken });
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      return { positional, values, flags, ordered, help: true };
    }
    if (valueFlags.has(arg)) {
      const value = args[index + 1];
      if (value === undefined) {
        throw usageSurfaceError(`${arg} requires a value`, help);
      }
      record(arg, [value]);
      index += 1;
      continue;
    }
    if (pairFlags.has(arg)) {
      const first = args[index + 1];
      const second = args[index + 2];
      if (first === undefined || second === undefined) {
        throw usageSurfaceError(`${arg} requires two values`, help);
      }
      record(arg, [first, second]);
      index += 2;
      continue;
    }
    if (booleanFlags.has(arg)) {
      flags.add(arg);
      continue;
    }
    if (arg.startsWith('--') || (arg.startsWith('-') && arg.length > 1)) {
      throw usageSurfaceError(`Unknown option: ${arg}`, help);
    }
    positional.push(arg);
  }

  return { positional, values, flags, ordered, help: false };
}

export function usageSurfaceError(message: string, help: string): SurfaceError {
  return surfaceError('usage', message, { help });
}

export function singleValue(
  parsed: ParsedSurfaceArgs,
  flag: string
): string | undefined {
  const found = parsed.values.get(flag);
  if (!found) return undefined;
  return found[found.length - 1];
}

export function requireValue(
  parsed: ParsedSurfaceArgs,
  flag: string,
  help: string
): string {
  const found = singleValue(parsed, flag);
  if (found === undefined) {
    throw usageSurfaceError(`${flag} is required`, help);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every subcommand answers in one of two registers, and both come from the
 * same object: a JSON document for a program, and lines for a person.
 */
export interface SurfaceReport {
  json: Record<string, unknown>;
  lines: string[];
}

export function emitReport(
  deps: SurfaceDeps,
  report: SurfaceReport,
  asJson: boolean
): number {
  if (asJson) {
    writeLine(deps.stdout, JSON.stringify({ ok: true, ...report.json }));
    return 0;
  }
  for (const line of report.lines) {
    writeLine(deps.stdout, line);
  }
  return 0;
}

/**
 * A machine-readable document on stdout, verbatim. Used where the command's
 * own `ok` is not simply "it worked" — `surface lint` reports the gate's
 * verdict, which is a finding rather than a status.
 */
export function writeSurfaceJson(
  deps: SurfaceDeps,
  document: Record<string, unknown>
): void {
  writeLine(deps.stdout, JSON.stringify(document));
}

export function readJsonFile(
  deps: SurfaceDeps,
  path: string,
  label: string
): unknown {
  let text: string;
  try {
    text = deps.readTextFile(path);
  } catch (error) {
    throw surfaceError(
      'usage',
      `Could not read the ${label} at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { path }
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw surfaceError(
      'spec-file-invalid',
      `The ${label} at ${path} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { path }
    );
  }
}
