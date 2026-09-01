import type { SurfaceSpec } from '@tloncorp/api';

import {
  type ParsedSurfaceArgs,
  type SurfaceDeps,
  type SurfacePostRecord,
  type SurfaceReport,
  assertSnapshotRecordValid,
  emitReport,
  parseSurfaceArgs,
  singleValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';
import {
  hydratePosts,
  postSurfaceRecord,
  requireChannelSpec,
  resolveSurfaceChannel,
  retractSurfacePost,
} from './surface-writer';

export const SURFACE_EVENT_HELP = `Usage: tlon surface event <channel> [ops...] [--json]
       tlon surface event <channel> --retract <post-id> [--json]

Post a host update to a dashboard, or retract one you posted earlier.

Ops apply in the order they are written. Values are JSON, so a string needs
its quotes: --set /title '"Friday"'.

Ops:
  --set <path> <json>     Write a value at a JSON Pointer path
  --del <path>            Remove the value at a path
  --append <path> <json>  Append to an existing array

Options:
  --ops <json>          An ops array as JSON, instead of the flags above
  --ops-file <path>     An ops array read from a file
  --fallback <text>     Text pre-surface clients see (default: a plain line)
  --retract <post-id>   Retract a record by editing it — the reducer skips
                        any edited surface post
  --json                Emit a machine-readable result
  -h, --help            Show this help

Example:
  tlon surface event chat/~zod/dash-abc \\
    --set /history/2026-08-28 '{"~zod":"ok"}' --del /today`;

export const SURFACE_STATE_HELP = `Usage: tlon surface state <channel> [--json] [--max-posts <n>]

Hydrate a dashboard and print its reduced state.

The fold runs through the same reducer the app clients run, over the whole
channel history. If the history cannot be read to its start the command
fails rather than printing a partial fold — an incomplete fold is wrong
state, not stale state.

State is what members have PUT in the dashboard. It is not the app: the
definition, its recipe and its bundle are what \`tlon surface show <channel>\`
returns, and that is the command to run before revising anything.

Options:
  --max-posts <n>  Stop after this many posts (default 5000)
  --json           Emit a machine-readable result
  -h, --help       Show this help`;

/** The one spelling of the escape hatch: parser, help text and refusal. */
export const ALLOW_ABORTED_FLAG = '--allow-aborted-events';

export const SURFACE_SNAPSHOT_HELP = `Usage: tlon surface snapshot <channel> [--up-to <n>] [--json]
       tlon surface snapshot <channel> --retract <post-id> [--json]

Post a snapshot of a dashboard's current state, compacting its history.

The snapshot is written at the channel's CURRENT revision — a snapshot at
any other revision is unusable, and there is no cross-revision selection.

This is also the repair for a channel stuck waiting on a migration snapshot:
run it with no options and the host's snapshot is reconstructed from the
state the previous revision was last folded to, which is what unsticks the
dashboard without discarding what members put in it.

Options:
  --up-to <n>          Sequence boundary the snapshot covers (default: the
                       newest post in the channel; not accepted while
                       repairing a missing migration snapshot, where the
                       boundary is derived). State is folded from the events
                       at or below it, so everything above stays replayable
                       — and retractable.
  ${ALLOW_ABORTED_FLAG}
                       Snapshot even though an entry in the fold stopped
                       early. Its state is that entry's partial prefix, and
                       the boundary covers the entry, so the failed write is
                       finalized as history — check \`tlon surface state\`
                       first and re-post what was lost
  --fallback <text>    Text pre-surface clients see
  --retract <post-id>  Retract a snapshot by editing it
  --json               Emit a machine-readable result
  -h, --help           Show this help`;

/* ------------------------------------------------------------------ */
/* Ops                                                                 */
/* ------------------------------------------------------------------ */

export type SurfaceOpInput =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'del'; path: string }
  | { op: 'append'; path: string; value: unknown };

function parseOpValue(raw: string, flag: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw surfaceError(
      'invalid-ops',
      `${flag} needs a JSON value, and "${raw}" is not one. A bare string needs its quotes: '"${raw}"'.`,
      { flag, value: raw }
    );
  }
}

/** Ops in argv order, from the flag forms and the bulk forms alike. */
export function collectOps(
  parsed: ParsedSurfaceArgs,
  deps: SurfaceDeps
): SurfaceOpInput[] {
  const ops: SurfaceOpInput[] = [];

  const bulkText = singleValue(parsed, '--ops');
  const bulkPath = singleValue(parsed, '--ops-file');
  if (bulkText !== undefined && bulkPath !== undefined) {
    throw surfaceError(
      'invalid-ops',
      '--ops and --ops-file cannot both be given.',
      {}
    );
  }
  const bulk =
    bulkText !== undefined
      ? bulkText
      : bulkPath !== undefined
        ? deps.readTextFile(bulkPath)
        : null;
  if (bulk !== null) {
    let parsedBulk: unknown;
    try {
      parsedBulk = JSON.parse(bulk);
    } catch {
      throw surfaceError(
        'invalid-ops',
        'The ops document is not valid JSON.',
        {}
      );
    }
    if (!Array.isArray(parsedBulk)) {
      throw surfaceError(
        'invalid-ops',
        'The ops document must be a JSON array of ops.',
        {}
      );
    }
    ops.push(...(parsedBulk as SurfaceOpInput[]));
  }

  for (const occurrence of parsed.ordered) {
    if (occurrence.flag === '--set') {
      ops.push({
        op: 'set',
        path: occurrence.values[0],
        value: parseOpValue(occurrence.values[1], '--set'),
      });
    } else if (occurrence.flag === '--append') {
      ops.push({
        op: 'append',
        path: occurrence.values[0],
        value: parseOpValue(occurrence.values[1], '--append'),
      });
    } else if (occurrence.flag === '--del') {
      ops.push({ op: 'del', path: occurrence.values[0] });
    }
  }

  return ops;
}

/**
 * `$actor` anywhere in a host op.
 *
 * The reducer skips such an op — substitution is permitted only inside
 * spec-declared action ops, because a host supplies its own values and
 * there is no actor to resolve. Skipping is the right reducer behavior and
 * the wrong writer behavior: a host event whose only op is silently dropped
 * posts successfully and does nothing, which is the failure mode this whole
 * command group exists to make impossible.
 */
export function usesActorPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') return value === '$actor';
  if (Array.isArray(value)) return value.some(usesActorPlaceholder);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(
      usesActorPlaceholder
    );
  }
  return false;
}

export function validateHostOps(
  deps: SurfaceDeps,
  ops: SurfaceOpInput[]
): void {
  if (ops.length === 0) {
    throw surfaceError(
      'invalid-ops',
      'A host update needs at least one op.',
      {}
    );
  }
  if (ops.length > deps.caps.opsPerEvent) {
    throw surfaceError(
      'invalid-ops',
      `A host update carries at most ${deps.caps.opsPerEvent} ops; this one has ${ops.length}.`,
      { count: ops.length, cap: deps.caps.opsPerEvent }
    );
  }
  ops.forEach((op, index) => {
    if (op.op !== 'set' && op.op !== 'del' && op.op !== 'append') {
      throw surfaceError(
        'invalid-ops',
        `Op ${index + 1} has an unknown kind "${String((op as { op: unknown }).op)}".`,
        { index }
      );
    }
    if (typeof op.path !== 'string') {
      throw surfaceError('invalid-ops', `Op ${index + 1} has no path.`, {
        index,
      });
    }
    const pointer = deps.parsePointer(op.path);
    if (!pointer.ok) {
      throw surfaceError(
        'invalid-ops',
        `Op ${index + 1} has an unusable path "${op.path}": ${pointer.error}.`,
        { index, path: op.path, error: pointer.error }
      );
    }
    if (pointer.segments.includes('$actor')) {
      throw surfaceError(
        'invalid-ops',
        `Op ${index + 1} uses $actor in its path. $actor is only meaningful inside a declared action, where an actor exists; in a host update the op would be silently skipped.`,
        { index, path: op.path }
      );
    }
    if ('value' in op && usesActorPlaceholder(op.value)) {
      throw surfaceError(
        'invalid-ops',
        `Op ${index + 1} uses $actor in its value. In a host update that op would be silently skipped.`,
        { index, path: op.path }
      );
    }
  });
}

/* ------------------------------------------------------------------ */
/* surface event                                                       */
/* ------------------------------------------------------------------ */

export async function runSurfaceEvent(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    {
      value: ['--del', '--ops', '--ops-file', '--fallback', '--retract'],
      pair: ['--set', '--append'],
      boolean: ['--json'],
    },
    SURFACE_EVENT_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_EVENT_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const channelId = requirePositionalChannel(parsed, SURFACE_EVENT_HELP);
  const budget = deps.observationBudget;

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'write',
    operation: 'surface event',
  });
  const spec = requireChannelSpec(deps, resolved);

  const retractId = singleValue(parsed, '--retract');
  if (retractId !== undefined) {
    const written = await retractSurfacePost(deps, {
      channelId,
      postId: retractId,
      kind: 'event',
      fallback: singleValue(parsed, '--fallback') ?? '(withdrawn)',
      budget,
    });
    return emitReport(
      deps,
      {
        json: {
          channel: channelId,
          outcome: 'retracted',
          post: written.postId,
          kind: written.kind,
          observed:
            'the post is marked edited and still carries its surface kind',
        },
        lines: [
          `Retracted ${written.postId} in ${channelId}`,
          `  observed: marked edited, kind still ${written.kind}`,
        ],
      },
      asJson
    );
  }

  const ops = collectOps(parsed, deps);
  validateHostOps(deps, ops);

  const written = await postSurfaceRecord(deps, {
    channelId,
    kind: 'event',
    fallback: singleValue(parsed, '--fallback') ?? 'Updated the dashboard.',
    entry: {
      type: 'surface-event',
      version: 1,
      surfaceId: spec.surfaceId,
      specRevision: spec.specRevision,
      mode: 'host',
      ops,
    },
    budget,
  });

  return emitReport(
    deps,
    {
      json: {
        channel: channelId,
        outcome: 'posted',
        post: written.postId,
        sequenceNum: written.sequenceNum,
        kind: written.kind,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        ops: ops.length,
        observed:
          'the post was read back from the channel with its surface kind intact',
      },
      lines: [
        `Posted a host update to ${channelId}`,
        `  post:     ${written.postId} (sequence ${written.sequenceNum ?? 'unknown'})`,
        `  revision: ${spec.specRevision}`,
        `  ops:      ${ops.length}`,
        `  observed: read back from the channel as ${written.kind}`,
      ],
    },
    asJson
  );
}

/* ------------------------------------------------------------------ */
/* surface state                                                       */
/* ------------------------------------------------------------------ */

export async function runSurfaceState(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    { value: ['--max-posts'], boolean: ['--json'] },
    SURFACE_STATE_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_STATE_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const channelId = requirePositionalChannel(parsed, SURFACE_STATE_HELP);
  const maxPosts = readCount(parsed, '--max-posts', SURFACE_STATE_HELP);

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'read',
  });
  const spec = requireChannelSpec(deps, resolved);

  const hydrated = await hydratePosts(deps, channelId, { maxPosts });
  if (!hydrated.complete) {
    throw surfaceError(
      'partial-hydration',
      `Only part of ${channelId}'s history could be read (${hydrated.posts.length} posts over ${hydrated.pages} pages), so no state can be reported. A partial fold is wrong state, not stale state.`,
      {
        channel: channelId,
        posts: hydrated.posts.length,
        pages: hydrated.pages,
      }
    );
  }

  const reduction = deps.reduce({
    spec,
    hostShip: resolved.hostShip,
    posts: hydrated.posts,
  });

  if (reduction.status === 'migration-pending') {
    // A defined state, not a failure: the definition preserves state and
    // the migration snapshot at this revision has not landed. Reporting a
    // fold here would be reporting state the surface is not showing.
    return emitReport(
      deps,
      {
        json: {
          channel: channelId,
          status: 'migration-pending',
          surfaceId: spec.surfaceId,
          specRevision: spec.specRevision,
          state: null,
        },
        lines: [
          `${channelId} is waiting on its migration snapshot at revision ${spec.specRevision}.`,
          '  No state is available until the host posts it.',
        ],
      },
      asJson
    );
  }

  const report: SurfaceReport = {
    json: {
      channel: channelId,
      status: 'reduced',
      surfaceId: spec.surfaceId,
      specRevision: spec.specRevision,
      state: reduction.state,
      baseSnapshotSeq: reduction.baseSnapshotSeq,
      newestFoldedSeq: reduction.newestFoldedSeq,
      stateFull: reduction.stateFull,
      foldedEventCount: reduction.foldedEventCount,
      skippedEventCount: reduction.skippedEventCount,
      // An aborted entry is a host's own write that half-landed, and it is
      // invisible in every other number here: it counts as folded, it is not
      // skipped, and only a `state-cap` refusal raises `stateFull`. Reporting
      // the fold without it tells a host its last update succeeded. The
      // sequence numbers rather than a count, because the repair is to go and
      // look at those posts.
      abortedSequenceNums: reduction.abortedSequenceNums,
      posts: hydrated.posts.length,
    },
    lines: [
      `${channelId} at revision ${spec.specRevision}`,
      `  folded ${reduction.foldedEventCount} event${
        reduction.foldedEventCount === 1 ? '' : 's'
      }, skipped ${reduction.skippedEventCount}, from ${
        reduction.baseSnapshotSeq === null
          ? 'the starting state'
          : `snapshot at sequence ${reduction.baseSnapshotSeq}`
      }`,
      ...(reduction.abortedSequenceNums.length > 0
        ? [
            `  ${reduction.abortedSequenceNums.length} ${describeAbortedEntries(
              reduction.abortedSequenceNums
            )} stopped early: state refused an op, so the ops written after it never applied`,
          ]
        : []),
      ...(reduction.stateFull
        ? ['  the state cap was hit; some ops were refused']
        : []),
      JSON.stringify(reduction.state, null, 2),
    ],
  };
  return emitReport(deps, report, asJson);
}

/* ------------------------------------------------------------------ */
/* surface snapshot                                                    */
/* ------------------------------------------------------------------ */

export async function runSurfaceSnapshot(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    {
      value: ['--up-to', '--fallback', '--retract', '--max-posts'],
      boolean: ['--json', ALLOW_ABORTED_FLAG],
    },
    SURFACE_SNAPSHOT_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_SNAPSHOT_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const channelId = requirePositionalChannel(parsed, SURFACE_SNAPSHOT_HELP);
  const budget = deps.observationBudget;

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId, {
    intent: 'write',
    operation: 'surface snapshot',
  });
  const spec = requireChannelSpec(deps, resolved);

  const retractId = singleValue(parsed, '--retract');
  if (retractId !== undefined) {
    const written = await retractSurfacePost(deps, {
      channelId,
      postId: retractId,
      kind: 'snapshot',
      fallback: singleValue(parsed, '--fallback') ?? '(withdrawn)',
      budget,
    });
    return emitReport(
      deps,
      {
        json: {
          channel: channelId,
          outcome: 'retracted',
          post: written.postId,
          kind: written.kind,
          observed:
            'the post is marked edited and still carries its surface kind',
        },
        lines: [
          `Retracted snapshot ${written.postId} in ${channelId}`,
          `  observed: marked edited, kind still ${written.kind}`,
        ],
      },
      asJson
    );
  }

  const hydrated = await hydratePosts(deps, channelId, {
    maxPosts: readCount(parsed, '--max-posts', SURFACE_SNAPSHOT_HELP),
  });
  if (!hydrated.complete) {
    throw surfaceError(
      'partial-hydration',
      `Only part of ${channelId}'s history could be read, so a snapshot would freeze a fold that is missing events.`,
      { channel: channelId, pages: hydrated.pages }
    );
  }

  const reduction = deps.reduce({
    spec,
    hostShip: resolved.hostShip,
    posts: hydrated.posts,
  });

  const newest = newestSequenceNum(hydrated.posts);
  const requested = singleValue(parsed, '--up-to');

  // A pending revision is the one state this command MUST be able to act on.
  // It used to refuse here, which forbade the only repair a stranded channel
  // has: the migration snapshot is missing, `surface publish` re-runs into
  // its own no-op path, and a further preserving publish cannot migrate off a
  // pending revision either. The refusal was protecting something real —
  // there is no folded state at a pending revision, so a naive snapshot would
  // invent one — and that protection is kept below by RECONSTRUCTING the
  // state rather than defaulting to anything.
  if (reduction.status === 'migration-pending') {
    if (requested !== undefined) {
      throw usageSurfaceError(
        `${channelId} is repairing a missing migration snapshot, so its boundary is derived from the state being carried across and --up-to cannot be supplied`,
        SURFACE_SNAPSHOT_HELP
      );
    }
    const repair = repairPendingMigration(
      deps,
      resolved,
      spec,
      hydrated.posts,
      {
        allowAborted: parsed.flags.has(ALLOW_ABORTED_FLAG),
      }
    );
    const entry = {
      type: 'surface-snapshot',
      version: 1,
      surfaceId: spec.surfaceId,
      specRevision: spec.specRevision,
      upToSequenceNum: repair.upToSequenceNum,
      state: repair.state,
    };
    assertSnapshotRecordValid(deps, entry, {
      channel: channelId,
      specRevision: spec.specRevision,
    });
    const written = await postSurfaceRecord(deps, {
      channelId,
      kind: 'snapshot',
      fallback:
        singleValue(parsed, '--fallback') ??
        'Restored the dashboard after an update.',
      entry,
      budget,
    });
    return emitReport(
      deps,
      {
        json: {
          channel: channelId,
          outcome: 'posted',
          repairedMigration: true,
          post: written.postId,
          kind: written.kind,
          surfaceId: spec.surfaceId,
          specRevision: spec.specRevision,
          upToSequenceNum: repair.upToSequenceNum,
          carriedFromRevision: repair.fromRevision,
          abortedSequenceNums: repair.abortedSequenceNums,
          observed:
            'the snapshot was read back from the channel with its surface kind intact',
        },
        lines: [
          `Repaired ${channelId}: posted the missing migration snapshot`,
          `  post:     ${written.postId}`,
          `  revision: ${spec.specRevision}`,
          `  carried:  state from revision ${repair.fromRevision ?? 'the definition itself'}`,
          `  covers:   sequences up to ${repair.upToSequenceNum}`,
          ...abortedWaivedLines(repair.abortedSequenceNums),
          `  observed: read back from the channel as ${written.kind}`,
        ],
      },
      asJson
    );
  }

  let upToSequenceNum = newest;
  if (requested !== undefined) {
    const parsedBoundary = Number(requested);
    if (!Number.isInteger(parsedBoundary) || parsedBoundary < 0) {
      throw usageSurfaceError(
        '--up-to must be a non-negative whole number',
        SURFACE_SNAPSHOT_HELP
      );
    }
    if (parsedBoundary > newest) {
      throw surfaceError(
        'usage',
        `--up-to ${parsedBoundary} is beyond the newest post in ${channelId} (sequence ${newest}); the snapshot would claim to cover history that does not exist.`,
        { requested: parsedBoundary, newest }
      );
    }
    upToSequenceNum = parsedBoundary;
  }

  // The state and the boundary it claims have to come from the SAME events.
  // The reducer trusts the pair and never checks it: it starts from the state
  // and replays everything strictly above the boundary. A state folded PAST
  // the boundary therefore holds the events above it AND leaves them
  // replayable, so every client double-counts them on every fold, for as long
  // as the snapshot stands. (The other direction is worse but is not reachable
  // here: a state folded SHORT of its boundary loses those events outright,
  // because the reducer never looks below a boundary again.)
  //
  // The fold above runs over the whole history, which is the right population
  // for the default boundary and only for that one, so a lower boundary is
  // re-folded to itself.
  let folded = reduction;
  if (upToSequenceNum < newest) {
    const bounded = deps.reduce({
      spec,
      hostShip: resolved.hostShip,
      posts: hydrated.posts.filter(
        (post) =>
          typeof post.sequenceNum === 'number' &&
          post.sequenceNum <= upToSequenceNum
      ),
    });
    if (bounded.status !== 'reduced') {
      // The snapshot this preserving revision folds from was posted above the
      // boundary, so at that boundary the revision has no state at all. The
      // migration gate exists to stop a state being invented here, and a
      // default would be inventing one.
      throw surfaceError(
        'usage',
        `--up-to ${upToSequenceNum} is below the snapshot ${channelId} folds from at revision ${spec.specRevision}, so there is no state at that boundary to write.`,
        {
          requested: upToSequenceNum,
          specRevision: spec.specRevision,
          baseSnapshotSeq: reduction.baseSnapshotSeq,
        }
      );
    }
    folded = bounded;
  }

  assertNoAbortedEntries(folded, {
    channel: channelId,
    specRevision: spec.specRevision,
    allowed: parsed.flags.has(ALLOW_ABORTED_FLAG),
  });

  const entry = {
    type: 'surface-snapshot',
    version: 1,
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    upToSequenceNum,
    state: folded.state,
  };
  assertSnapshotRecordValid(deps, entry, {
    channel: channelId,
    specRevision: spec.specRevision,
  });
  const written = await postSurfaceRecord(deps, {
    channelId,
    kind: 'snapshot',
    fallback:
      singleValue(parsed, '--fallback') ??
      'Saved a checkpoint of the dashboard.',
    entry,
    budget,
  });

  return emitReport(
    deps,
    {
      json: {
        channel: channelId,
        outcome: 'posted',
        repairedMigration: false,
        post: written.postId,
        kind: written.kind,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        upToSequenceNum,
        foldedEventCount: folded.foldedEventCount,
        abortedSequenceNums: folded.abortedSequenceNums,
        observed:
          'the snapshot was read back from the channel with its surface kind intact',
      },
      lines: [
        `Posted a snapshot to ${channelId}`,
        `  post:     ${written.postId}`,
        `  revision: ${spec.specRevision}`,
        `  covers:   sequences up to ${upToSequenceNum}`,
        ...abortedWaivedLines(folded.abortedSequenceNums),
        `  observed: read back from the channel as ${written.kind}`,
      ],
    },
    asJson
  );
}

/* ------------------------------------------------------------------ */
/* Migration repair                                                    */
/* ------------------------------------------------------------------ */

export interface MigrationRepair {
  state: Record<string, unknown>;
  /** the boundary the reconstructed state actually covers */
  upToSequenceNum: number;
  /** the revision the state was carried from, or null when there was none */
  fromRevision: number | null;
  /** sequence numbers of entries in the carried fold that stopped early (§7) */
  abortedSequenceNums: number[];
}

export interface MigrationRepairOptions {
  /**
   * Reconstruct from a fold that contains an aborted entry anyway. The caller
   * owns the escape hatch, because it owns the argument that opens it.
   */
  allowAborted: boolean;
  /** what to tell the caller it can do instead of refusing */
  abortRemedy?: string;
  /** the help text the refusal carries, so the flag is taught in context */
  abortHelp?: string;
}

/**
 * "entry at sequence 11" / "entries at sequences 11, 17".
 *
 * One spelling, so every place an abort is mentioned — the fold report, the
 * refusal, the line that records a waiver — names the same posts the same way
 * and a reader can go straight to them.
 */
export function describeAbortedEntries(sequenceNums: number[]): string {
  return sequenceNums.length === 1
    ? `entry at sequence ${sequenceNums[0]}`
    : `entries at sequences ${sequenceNums.join(', ')}`;
}

/**
 * The line a command prints when `--allow-aborted-events` let it write anyway.
 *
 * An escape hatch leaves an audit trail, not a silence (D99): the flag makes
 * this the last moment anything can name these entries, because the snapshot
 * that follows puts them under the boundary and every later fold reports a
 * clean history. Naming them in the output is the only record that survives.
 */
export function abortedWaivedLines(sequenceNums: number[]): string[] {
  if (sequenceNums.length === 0) return [];
  return [
    `  aborted:  ${sequenceNums.length} ${describeAbortedEntries(
      sequenceNums
    )} stopped early and ${
      sequenceNums.length === 1 ? 'was' : 'were'
    } checkpointed anyway; the ops written after each refusal are not in this state and no later fold reports them`,
  ];
}

/**
 * Refuses to write a snapshot over a fold that stopped early.
 *
 * An aborted entry leaves state at that entry's PREFIX: the reducer stops at
 * the refused op, so every op written after it — written on the assumption
 * that it landed — never applies. A snapshot pairs that prefix with a boundary
 * that covers the entry, and from then on every fold starts above it. The
 * entry is finalized as history that succeeded, and both the ops that were
 * lost and the fact that they were lost are unrecoverable.
 *
 * All three snapshot-writing paths come through here — standalone `surface
 * snapshot`, the migration repair, and the primary preserving publish — and
 * every one of them checks BEFORE it writes anything, which is what makes a
 * refusal safe on the publish paths: it cannot itself strand a channel.
 *
 * The escape hatch is named for exactly the thing it accepts rather than being
 * a general `--force`, and this refusal carries the calling command's own help
 * so the flag is in front of whoever hit it. A repair loop that retries with
 * every flag it can find is the failure mode a general one has.
 */
export function assertNoAbortedEntries(
  folded: { abortedSequenceNums: number[] },
  context: {
    channel: string;
    specRevision: number;
    allowed: boolean;
    remedy?: string;
    help?: string;
  }
): void {
  const aborted = folded.abortedSequenceNums;
  const count = aborted.length;
  if (context.allowed || count === 0) return;
  throw surfaceError(
    'usage',
    `${context.channel} folds ${count} ${
      count === 1 ? 'entry that stopped' : 'entries that stopped'
    } early at revision ${context.specRevision} — ${describeAbortedEntries(
      aborted
    )}: state refused an op, so the ops written after it never applied and this fold is that entry's partial prefix. A snapshot of it freezes the prefix AND puts the failed ${
      count === 1 ? 'entry' : 'entries'
    } under the boundary, where no later fold reaches ${
      count === 1 ? 'it' : 'them'
    } again. ${
      context.remedy ??
      `Check \`tlon surface state\`, re-post what was lost, or pass ${ALLOW_ABORTED_FLAG} to checkpoint the prefix as it stands.`
    }`,
    {
      channel: context.channel,
      specRevision: context.specRevision,
      abortedSequenceNums: aborted,
      help: context.help ?? SURFACE_SNAPSHOT_HELP,
    }
  );
}

/** The greatest sequence number in a post set, or 0 when there is none. */
export function newestSequenceNum(posts: SurfacePostRecord[]): number {
  let newest = 0;
  for (const post of posts) {
    if (typeof post.sequenceNum === 'number' && post.sequenceNum > newest) {
      newest = post.sequenceNum;
    }
  }
  return newest;
}

/**
 * Reconstructs the state a missing migration snapshot was supposed to carry.
 *
 * The state cannot come from the current revision — a preserving revision has
 * no folded state until its snapshot lands, and the previous revision's
 * events no longer fold under it. It has to come from the definition the
 * state was last live under, and the channel keeps one: the spec mirror posts
 * are a verbatim revision history, which is what publish writes them for.
 *
 * Three protections carry over from the refusal this replaces, because the
 * thing it was guarding against is a repair that INVENTS state:
 *
 * - Only the channel host may repair. A non-host's snapshot is ignored by
 *   every reducer, so a non-host repair would report a fix that never
 *   happened.
 * - The previous definition is taken only from a HOST-authored, schema-valid
 *   mirror. Anything else would let a member steer the fold that decides what
 *   the surface's state becomes.
 * - Where the previous state cannot be reconstructed, this refuses instead of
 *   defaulting. `initialState` is used in exactly one case — no earlier
 *   revision and no earlier-revision events — where it is not a default but
 *   the true answer.
 */
export function repairPendingMigration(
  deps: SurfaceDeps,
  resolved: { channelId: string; hostShip: string },
  spec: SurfaceSpec,
  posts: SurfacePostRecord[],
  options: MigrationRepairOptions
): MigrationRepair {
  const { channelId, hostShip } = resolved;
  const host = deps.normalizeShip(hostShip);
  if (deps.normalizeShip(deps.actingShip()) !== host) {
    throw surfaceError(
      'migration-pending',
      `${channelId} is waiting on its migration snapshot at revision ${spec.specRevision}, and only its host ${host} can post one — a snapshot from anyone else is ignored by every client. Ask the host to run this command.`,
      { channel: channelId, specRevision: spec.specRevision, host }
    );
  }

  const previous = newestHostMirrorBelow(deps, posts, host, spec);
  if (!previous) {
    if (hasEventsBelowRevision(posts, spec)) {
      throw surfaceError(
        'migration-pending',
        `${channelId} is waiting on its migration snapshot at revision ${spec.specRevision}, and the definition its state was last live under is not recoverable: the channel holds events from an earlier revision but no mirror of that revision to fold them under. Reconstructing the state would mean guessing at it.`,
        { channel: channelId, specRevision: spec.specRevision }
      );
    }
    // Nothing has ever been folded here, so the state the revision preserves
    // is its own starting point — the same answer publish computes for a
    // channel with no readable prior definition.
    return {
      state: spec.initialState as Record<string, unknown>,
      upToSequenceNum: 0,
      fromRevision: null,
      abortedSequenceNums: [],
    };
  }

  const carried = deps.reduce({ spec: previous, hostShip, posts });
  if (carried.status !== 'reduced') {
    throw surfaceError(
      'migration-pending',
      `${channelId} is waiting on its migration snapshot at revision ${spec.specRevision}, but revision ${previous.specRevision} is waiting on one too, so there is no state to carry across. The chain of preserved state is broken and only a republish without --preserve-state can move the channel on.`,
      {
        channel: channelId,
        specRevision: spec.specRevision,
        previousRevision: previous.specRevision,
      }
    );
  }

  // The carried fold inherits the previous revision's aborted entries, and
  // freezing a partial prefix is exactly as destructive here as on the
  // ordinary path — more so, because those entries are tagged with a revision
  // that no longer folds, so nobody can re-post them.
  assertNoAbortedEntries(carried, {
    channel: channelId,
    specRevision: spec.specRevision,
    allowed: options.allowAborted,
    remedy: options.abortRemedy,
    help: options.abortHelp,
  });

  // The boundary is what the carried state actually covers, NOT the newest
  // post. Events already written at the current revision sit above it and go
  // on folding; a boundary at the newest post would freeze them out silently.
  return {
    state: carried.state as Record<string, unknown>,
    upToSequenceNum: carried.newestFoldedSeq ?? 0,
    fromRevision: previous.specRevision,
    abortedSequenceNums: carried.abortedSequenceNums,
  };
}

/** Every surface entry in a post's blob, or none if it does not parse. */
function blobEntries(
  blob: string | null | undefined
): Record<string, unknown>[] {
  if (typeof blob !== 'string' || blob.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  );
}

/**
 * The highest-revision definition below the current one, from the channel's
 * own host-authored, schema-valid mirrors.
 */
function newestHostMirrorBelow(
  deps: SurfaceDeps,
  posts: SurfacePostRecord[],
  host: string,
  spec: SurfaceSpec
): SurfaceSpec | null {
  let best: SurfaceSpec | null = null;
  for (const post of posts) {
    if (post.isDeleted || post.isEdited) continue;
    if (typeof post.sequenceNum !== 'number') continue;
    if (deps.normalizeShip(post.authorId) !== host) continue;
    for (const entry of blobEntries(post.blob)) {
      if (entry.type !== 'surface-spec-mirror') continue;
      if (entry.surfaceId !== spec.surfaceId) continue;
      if (!deps.validateEntry('spec', entry).ok) continue;
      // Validated by SurfaceSpecMirrorEntrySchema, which embeds the spec
      // schema, so the inner value is a spec by the same definition every
      // client uses.
      const mirrored = entry.spec as SurfaceSpec;
      if (mirrored.specRevision >= spec.specRevision) continue;
      if (best === null || mirrored.specRevision > best.specRevision) {
        best = mirrored;
      }
    }
  }
  return best;
}

/**
 * Whether the channel holds any state-bearing record for a surface.
 *
 * The sibling below asks the same question of a channel whose definition can
 * be READ, so it can compare revisions. This one is for the case where it
 * cannot: any event or snapshot naming this surface was written under a
 * definition that is gone, so there is state behind it and no way to fold it.
 *
 * Retracted records do not count. An edited surface post contributes nothing
 * to any fold, so there is no state behind it to guess at — refusing on one
 * would refuse a channel whose surface history has already been withdrawn.
 */
export function hasSurfaceStateRecords(
  posts: SurfacePostRecord[],
  surfaceId: unknown
): boolean {
  return posts.some(
    (post) =>
      !post.isDeleted &&
      !post.isEdited &&
      blobEntries(post.blob).some(
        (entry) =>
          (entry.type === 'surface-event' ||
            entry.type === 'surface-snapshot') &&
          entry.surfaceId === surfaceId
      )
  );
}

/** Any surface event tagged with a revision older than the current one. */
function hasEventsBelowRevision(
  posts: SurfacePostRecord[],
  spec: SurfaceSpec
): boolean {
  return posts.some((post) =>
    blobEntries(post.blob).some(
      (entry) =>
        entry.type === 'surface-event' &&
        entry.surfaceId === spec.surfaceId &&
        typeof entry.specRevision === 'number' &&
        entry.specRevision < spec.specRevision
    )
  );
}

/* ------------------------------------------------------------------ */
/* Shared argument handling                                            */
/* ------------------------------------------------------------------ */

function requirePositionalChannel(
  parsed: ParsedSurfaceArgs,
  help: string
): string {
  const channelId = parsed.positional[0];
  if (!channelId) {
    throw usageSurfaceError('a channel id is required', help);
  }
  if (parsed.positional.length > 1) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[1]}`,
      help
    );
  }
  return channelId;
}

function readCount(
  parsed: ParsedSurfaceArgs,
  flag: string,
  help: string
): number | undefined {
  const raw = singleValue(parsed, flag);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw usageSurfaceError(`${flag} must be a positive whole number`, help);
  }
  return value;
}
