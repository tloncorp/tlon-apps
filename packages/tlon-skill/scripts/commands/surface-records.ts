import {
  type ParsedSurfaceArgs,
  type SurfaceDeps,
  type SurfaceReport,
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
import { newestSequenceNum } from './surface-publish';

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

Options:
  --max-posts <n>  Stop after this many posts (default 5000)
  --json           Emit a machine-readable result
  -h, --help       Show this help`;

export const SURFACE_SNAPSHOT_HELP = `Usage: tlon surface snapshot <channel> [--up-to <n>] [--json]
       tlon surface snapshot <channel> --retract <post-id> [--json]

Post a snapshot of a dashboard's current state, compacting its history.

The snapshot is written at the channel's CURRENT revision — a snapshot at
any other revision is unusable, and there is no cross-revision selection.

Options:
  --up-to <n>          Sequence boundary the snapshot covers (default: the
                       newest post in the channel)
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
  const resolved = await resolveSurfaceChannel(deps, channelId);
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
  const resolved = await resolveSurfaceChannel(deps, channelId);
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
      boolean: ['--json'],
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
  const resolved = await resolveSurfaceChannel(deps, channelId);
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
  if (reduction.status === 'migration-pending') {
    throw surfaceError(
      'migration-pending',
      `${channelId} has no state to snapshot: its definition preserves state and the migration snapshot at revision ${spec.specRevision} has not been posted.`,
      { channel: channelId, specRevision: spec.specRevision }
    );
  }

  const newest = newestSequenceNum(hydrated.posts);
  const requested = singleValue(parsed, '--up-to');
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

  const written = await postSurfaceRecord(deps, {
    channelId,
    kind: 'snapshot',
    fallback:
      singleValue(parsed, '--fallback') ??
      'Saved a checkpoint of the dashboard.',
    entry: {
      type: 'surface-snapshot',
      version: 1,
      surfaceId: spec.surfaceId,
      specRevision: spec.specRevision,
      upToSequenceNum,
      state: reduction.state,
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
        kind: written.kind,
        surfaceId: spec.surfaceId,
        specRevision: spec.specRevision,
        upToSequenceNum,
        foldedEventCount: reduction.foldedEventCount,
        observed:
          'the snapshot was read back from the channel with its surface kind intact',
      },
      lines: [
        `Posted a snapshot to ${channelId}`,
        `  post:     ${written.postId}`,
        `  revision: ${spec.specRevision}`,
        `  covers:   sequences up to ${upToSequenceNum}`,
        `  observed: read back from the channel as ${written.kind}`,
      ],
    },
    asJson
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
