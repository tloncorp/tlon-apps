/**
 * The write fence: an operator-set bound on which channel a surface write may
 * land in, and on what that channel must still look like when it lands.
 *
 * ## The failure this exists for
 *
 * In the verdict run a revision was asserted against one board and published to
 * a different, similarly-named one in a group the run had no business touching.
 * Every check passed: the preflight exited 0, the CLI exited 0, the gate was
 * clean, the rubric was complete, and publish read its own write back. The
 * read-back is the point — it confirmed the definition landed, which it had.
 * Nothing anywhere compared *where it landed* against *where it was supposed
 * to*, because until now nothing knew the second thing.
 *
 * The harness had the same hole one level up. `dev/surfaces-run.sh` binds the
 * SENTENCE to the request record so a preflight cannot clear one phrasing while
 * another goes down the wire. It never bound the TARGET.
 *
 * ## What a scope is
 *
 * A file, named by `TLON_SURFACE_SCOPE_FILE`, holding up to three claims:
 *
 *   channel   the only channel surface writes may touch
 *   preState  the identity that channel must still carry at write time
 *   groups    the groups surface writes may touch at all
 *
 * Absent env var, or absent file, means unfenced — the fence is opt-in, and a
 * CLI with no scope behaves exactly as it did before this file existed. Present
 * and unreadable is a refusal, not a fallback to unfenced: a fence that fails
 * open is decoration.
 *
 * It is a FILE and not three env vars because the process being fenced runs in
 * a container the harness cannot re-exec. The container's compose file names
 * the path once; the harness rewrites the file's contents per run. One
 * mechanism, not two.
 *
 * ## What it is not
 *
 * It is not authorization. A ship's own permissions decide what an agent may
 * write; this decides what THIS PROCESS was pointed at, and it is enforced in
 * the CLI, which is trivially bypassable by anyone who can run a different
 * binary. It exists to make a measurement instrument's target unambiguous and
 * to make an operator's blast radius explicit — nothing further.
 *
 * ## Why pre-state is spent by one publish
 *
 * `preState` binds a transformation: take THIS definition and produce another.
 * A second publish under one binding starts from a definition the operator
 * never asserted anything about, so it refuses. That is deliberate, and it
 * means a legitimate republish inside one bound turn will fail loudly rather
 * than silently widening the claim. The refusal names both identities and both
 * readings, because from inside the CLI "the channel moved under you" and "you
 * already published under this binding" are the same observation.
 */
import { surfaceError } from './commands/surface-common';

export const SCOPE_FILE_ENV = 'TLON_SURFACE_SCOPE_FILE';

export interface SurfaceWriteScope {
  /** Where the scope came from, quoted in every refusal so it can be found. */
  source: string;
  /** The only channel surface writes may touch, or null to fence by group alone. */
  channel: string | null;
  /** The identity `channel` must still carry when it is published to, or null. */
  preState: string | null;
  /** The groups writes may touch. An empty array fences everything out. */
  groups: string[] | null;
}

interface ScopeFileShape {
  channel?: unknown;
  preState?: unknown;
  groups?: unknown;
}

function scopeError(message: string, details: Record<string, unknown>): never {
  throw surfaceError('write-out-of-scope', message, details);
}

function preStateError(
  message: string,
  details: Record<string, unknown>
): never {
  throw surfaceError('pre-state-moved', message, details);
}

/**
 * Reads the scope named by the environment, or null when none is named.
 *
 * `readFile` is injected rather than imported so the runtime owns the one
 * filesystem read and tests own theirs — the same split every other IO in the
 * surface commands uses.
 */
export function loadSurfaceWriteScope(
  env: Record<string, string | undefined>,
  readFile: (path: string) => string
): SurfaceWriteScope | null {
  const path = env[SCOPE_FILE_ENV]?.trim();
  if (!path) return null;

  let raw: string;
  try {
    raw = readFile(path);
  } catch (error) {
    return scopeError(
      `${SCOPE_FILE_ENV} names ${path}, which could not be read: ${
        error instanceof Error ? error.message : String(error)
      }. A write fence that cannot be read is refused rather than ignored — treating it as "unfenced" would turn a typo into a silent removal of the bound.`,
      { scopeFile: path }
    );
  }

  let parsed: ScopeFileShape;
  try {
    parsed = JSON.parse(raw) as ScopeFileShape;
  } catch (error) {
    return scopeError(
      `${path} is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      { scopeFile: path }
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return scopeError(`${path} does not hold a JSON object.`, {
      scopeFile: path,
    });
  }

  const channel = readOptionalString(parsed.channel, 'channel', path);
  const preState = readOptionalString(parsed.preState, 'preState', path);
  const groups = readOptionalStringArray(parsed.groups, 'groups', path);

  if (channel === null && groups === null) {
    return scopeError(
      `${path} fences nothing: it names neither "channel" nor "groups". An empty scope file is more likely a half-written one than an intentional no-op, so it refuses rather than quietly permitting everything.`,
      { scopeFile: path }
    );
  }
  if (preState !== null && channel === null) {
    return scopeError(
      `${path} names a "preState" but no "channel". A pre-state identity is a claim about one channel; without naming which, it cannot be checked against anything.`,
      { scopeFile: path }
    );
  }

  return { source: path, channel, preState, groups };
}

function readOptionalString(
  value: unknown,
  key: string,
  path: string
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    return scopeError(
      `${path} has a "${key}" that is not a non-empty string.`,
      { scopeFile: path, key }
    );
  }
  return value.trim();
}

function readOptionalStringArray(
  value: unknown,
  key: string,
  path: string
): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    return scopeError(`${path} has a "${key}" that is not an array.`, {
      scopeFile: path,
      key,
    });
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return scopeError(
        `${path} has a "${key}"[${index}] that is not a non-empty string.`,
        { scopeFile: path, key, index }
      );
    }
    return entry.trim();
  });
}

/**
 * The identity a bound channel must still carry at publish time.
 *
 * Raw-to-raw (D72): the hash is taken over the description cell exactly as the
 * ship holds it, never over a validated-and-re-encoded copy, because a schema
 * that strips an unknown key would make two different stored cells hash the
 * same and the binding would stop distinguishing them.
 *
 * A channel with no surface definition has no spec to hash, and two different
 * empty channels would hash identically, so its identity is its post head
 * instead — which additionally makes "someone posted to it in between" a
 * mismatch rather than an invisible.
 */
export function surfacePreStateIdentity(input: {
  description: string | null | undefined;
  hasSpec: boolean;
  postHead: string | null;
  sha256Hex: (bytes: Uint8Array) => string;
}): string {
  if (input.hasSpec) {
    const bytes = new TextEncoder().encode(input.description ?? '');
    return `spec:${input.sha256Hex(bytes)}`;
  }
  return `unpublished:${input.postHead ?? 'empty'}`;
}

/** Refuses a write whose target lies outside the fence. */
export function assertWriteInScope(
  scope: SurfaceWriteScope | null,
  target: { channelId: string; groupId: string; operation: string }
): void {
  if (!scope) return;

  if (scope.groups !== null && !scope.groups.includes(target.groupId)) {
    scopeError(
      `${target.operation} would write to ${target.channelId}, which belongs to ${target.groupId} — a group this process is not scoped to. Scoped groups: ${
        scope.groups.length === 0 ? '(none)' : scope.groups.join(', ')
      }. Fence: ${scope.source}.`,
      {
        operation: target.operation,
        channel: target.channelId,
        group: target.groupId,
        scopedGroups: scope.groups,
        scopeFile: scope.source,
      }
    );
  }

  if (scope.channel !== null && scope.channel !== target.channelId) {
    scopeError(
      `${target.operation} would write to ${target.channelId}, but this process is bound to ${scope.channel}. Two similarly-named boards is exactly the mistake this bound exists to catch, so the write is refused rather than reported as a success against the wrong app. Fence: ${scope.source}.`,
      {
        operation: target.operation,
        channel: target.channelId,
        boundChannel: scope.channel,
        scopeFile: scope.source,
      }
    );
  }
}

/**
 * Refuses a publish whose target no longer carries the bound pre-state.
 *
 * Only publish calls this: it is the only operation that replaces the
 * definition, and so the only one for which "descends from" means anything.
 */
export function assertPreStateInScope(
  scope: SurfaceWriteScope | null,
  target: { channelId: string; observed: string; operation: string }
): void {
  if (!scope || scope.preState === null) return;
  if (scope.channel !== target.channelId) return;
  if (scope.preState === target.observed) return;

  preStateError(
    `${target.operation} was bound to ${target.channelId} as it stood at ${scope.preState}, but the channel now carries ${target.observed}. Either something else changed it since the bound was taken, or this binding has already been spent by an earlier publish — from here those are the same observation, and both mean the definition about to be replaced is not the one anybody asserted anything about. Fence: ${scope.source}.`,
    {
      operation: target.operation,
      channel: target.channelId,
      boundPreState: scope.preState,
      observedPreState: target.observed,
      scopeFile: scope.source,
    }
  );
}

/** One line for `--json` payloads and for the harness's own logs. */
export function describeSurfaceWriteScope(
  scope: SurfaceWriteScope | null
): Record<string, unknown> | null {
  if (!scope) return null;
  return {
    source: scope.source,
    channel: scope.channel,
    preState: scope.preState,
    groups: scope.groups,
  };
}
