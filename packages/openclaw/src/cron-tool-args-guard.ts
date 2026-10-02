/**
 * Refuses cron tool calls that carry either of two footgun arguments.
 *
 * `payload.fallbacks: []` makes a job strict — core reads an empty per-job
 * list as "no fallbacks" — and `delivery.bestEffort: true` suppresses the
 * failure alert on core 2026.7.1 whatever `failureAlert` says. The model fills
 * these optional fields with default-looking values on its own, so the hook
 * blocks the call with a reason and the model calls cron again without them.
 *
 * Core canonicalizes cron arguments from nested (`job`/`patch`), wrapped
 * (`data`/`job`), flat, padded-key and `namePayload` spellings, so the only
 * fact this detector relies on is that every spelling is a key whose `trim()`
 * is `fallbacks`/`bestEffort` somewhere in the params tree. Detection is
 * deliberately over-inclusive: a false positive costs one tool retry, a false
 * negative is the status quo.
 */

export interface ForbiddenCronArg {
  path: string;
  kind: 'empty-fallbacks' | 'best-effort';
}

const GUARDED_CRON_ACTIONS = new Set(['add', 'update']);
const GUARD_DISABLED_VALUES = new Set(['0', 'false', 'off']);
const MAX_DEPTH = 16;

/**
 * The only text the model receives for the vetoed call: OpenClaw returns
 * `blockReason` verbatim as the tool result. One line, within the 200-char cap
 * the owner "silent failure" notice truncates at.
 */
export const CRON_ARGS_BLOCK_REASON =
  'cron call rejected: remove `fallbacks: []` (leave fallbacks unset so the configured fallback models apply) and remove `bestEffort: true` from delivery, then call cron again.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function forbiddenKind(
  key: string,
  value: unknown
): ForbiddenCronArg['kind'] | undefined {
  if (key === 'fallbacks' && Array.isArray(value) && value.length === 0) {
    return 'empty-fallbacks';
  }
  if (key === 'bestEffort' && value === true) {
    return 'best-effort';
  }
  return undefined;
}

export function findForbiddenCronArgs(
  toolName: string,
  params: unknown
): ForbiddenCronArg[] {
  if (toolName !== 'cron' || !isPlainObject(params)) {
    return [];
  }
  if (!GUARDED_CRON_ACTIONS.has(String(params.action).trim())) {
    return [];
  }

  const found: ForbiddenCronArg[] = [];
  // Each visited node records the depth it was reached at, and a node is
  // skipped only when it was already visited at that depth or shallower. A
  // cycle always comes back deeper, so it is still cut; a node reached again by
  // a shallower path is re-walked, because descendants the depth cap hid on the
  // first visit can sit inside the cap on this one. Depth strictly decreases
  // across re-walks, so the walk terminates.
  const visitedDepths = new Map<object, number>();

  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      return;
    }
    if (Array.isArray(value)) {
      const visitedAt = visitedDepths.get(value);
      if (visitedAt !== undefined && visitedAt <= depth) {
        return;
      }
      visitedDepths.set(value, depth);
      value.forEach((item, index) => {
        walk(item, path ? `${path}.${index}` : String(index), depth + 1);
      });
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }
    const visitedAt = visitedDepths.get(value);
    if (visitedAt !== undefined && visitedAt <= depth) {
      return;
    }
    visitedDepths.set(value, depth);
    for (const [key, entry] of Object.entries(value)) {
      const name = key.trim();
      const entryPath = path ? `${path}.${name}` : name;
      const kind = forbiddenKind(name, entry);
      if (kind) {
        found.push({ path: entryPath, kind });
      }
      walk(entry, entryPath, depth + 1);
    }
  };

  walk(params, '', 0);
  return found;
}

export function isCronArgsGuardEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const value = (env.TLON_CRON_ARGS_GUARD ?? '').trim().toLowerCase();
  return !GUARD_DISABLED_VALUES.has(value);
}
