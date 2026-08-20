/**
 * Deciding what to do with one tap on an interactive card.
 *
 * Pure: it takes the card's current surface, the action, and whether the actor
 * may write, and returns what should happen. No I/O, no clock, no randomness —
 * so the authorization, idempotency, stale-revision and concurrency rules are
 * all directly testable.
 *
 * The protocol this implements is docs/tlon-apps/interactive-surfaces.md; the
 * client half is packages/app/ui/hooks/useInteractiveSurface.ts.
 */
import { INTERACTIVE_SURFACE_LIMITS } from '@tloncorp/api';

import { type JsonObject, applyStateOp } from './state-ops.js';

/** The authoritative state of a card, as carried on the bot's own post. */
export type SurfaceState = {
  surfaceId: string;
  revision: number;
  state: JsonObject;
  processedActionIds: string[];
};

/** One tap, as carried on the actor's reply. */
export type SurfaceAction = {
  surfaceId: string;
  actionId: string;
  /** Absent means "apply against whatever is current" — last-write-wins. */
  expectedRevision?: number;
  name: string;
  params?: JsonObject;
};

export type SurfaceDecision =
  /**
   * Edit the post. `revision` is unchanged when the action resolved to state
   * identical to what was stored — a no-change still records the action id so a
   * retry stays idempotent, but must not move the revision.
   */
  | {
      kind: 'apply';
      revision: number;
      state: JsonObject;
      processedActionIds: string[];
      /** True when only the action id changed. */
      noChange: boolean;
    }
  /** Already applied. Change nothing and, importantly, emit no edit. */
  | { kind: 'noop'; reason: string }
  /** Refused. Change nothing. */
  | { kind: 'reject'; reason: string };

/**
 * A card that carries no surface entry yet is at revision 0 with empty state.
 * The first tap on a freshly posted card creates the surface.
 */
export function emptySurface(surfaceId: string): SurfaceState {
  return { surfaceId, revision: 0, state: {}, processedActionIds: [] };
}

export function decideSurfaceAction({
  surface,
  action,
  actorMayWrite,
}: {
  surface: SurfaceState | null;
  action: SurfaceAction;
  actorMayWrite: boolean;
}): SurfaceDecision {
  // Authorization first, and before the idempotency check on purpose: an
  // unauthorized actor should not be able to learn which action ids a card has
  // already applied by watching which of its taps are refused differently.
  if (!actorMayWrite) {
    return { kind: 'reject', reason: 'actor may not write this channel' };
  }

  const current = surface ?? emptySurface(action.surfaceId);

  if (action.surfaceId !== current.surfaceId) {
    return { kind: 'reject', reason: 'action targets a different surface' };
  }

  // Already applied. No state change, no revision bump, and no edit — which
  // means the tapping client receives nothing and falls back to its timeout.
  // That is the documented contract, and emitting an edit here would instead
  // apply the action twice.
  if (current.processedActionIds.includes(action.actionId)) {
    return { kind: 'noop', reason: 'action already applied' };
  }

  if (
    action.expectedRevision !== undefined &&
    action.expectedRevision !== current.revision
  ) {
    return {
      kind: 'reject',
      reason: `stale revision: expected ${action.expectedRevision}, stored ${current.revision}`,
    };
  }

  const applied = applyStateOp(current.state, action.name, action.params);
  if (!applied.ok) {
    return { kind: 'reject', reason: applied.reason };
  }

  // Every byte here ships to every member on every edit, so an action that
  // would push state past the cap is refused rather than silently truncated.
  if (
    JSON.stringify(applied.state).length >
    INTERACTIVE_SURFACE_LIMITS.maxStateBytes
  ) {
    return { kind: 'reject', reason: 'state would exceed its size limit' };
  }

  const noChange = jsonEqual(applied.state, current.state);

  return {
    kind: 'apply',
    revision: noChange ? current.revision : current.revision + 1,
    state: applied.state,
    processedActionIds: rememberActionId(
      current.processedActionIds,
      action.actionId
    ),
    noChange,
  };
}

/**
 * Newest last, capped. Past the cap the oldest id is forgotten, so a very old
 * retry can apply a second time; the revision check catches most of that, since
 * a stale retry usually carries a stale expectedRevision too. Bounded growth
 * matters more here because this list replicates to every member.
 */
function rememberActionId(existing: string[], actionId: string): string[] {
  return [...existing, actionId].slice(
    -INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds
  );
}

/**
 * Structural equality over canonical JSON.
 *
 * Key order is normalized because two states that differ only in key order are
 * the same state, and treating them as different would bump the revision on
 * every tap — which is exactly the no-change case this exists to detect.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return canonicalize(a) === canonicalize(b);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(',')}}`;
}
