import {
  A2UI,
  INTERACTIVE_SURFACE_LIMITS,
  appendToPostBlob,
  findInteractiveSurface,
  parsePostBlob,
} from '@tloncorp/api';

import type { JsonObject } from '../monitor/state-ops.js';
import type { SurfaceState } from '../monitor/surface-actions.js';

export function serializeContextLensReferenceBlob(
  lensId: string,
  botShip?: string
): string {
  return JSON.stringify([
    {
      type: 'tlon-context-lens',
      version: 1,
      lensId,
      ...(botShip ? { botShip } : {}),
    },
  ]);
}

export const TLON_A2UI_CATALOG_ID = 'tlon.a2ui.basic.v1';
export type TlonA2UIBlob = A2UI.BlobEntry;

export function makeA2UIBlob(
  surfaceId: string,
  root: string,
  components: A2UI.Component[]
): TlonA2UIBlob {
  const blob: TlonA2UIBlob = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: TLON_A2UI_CATALOG_ID },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, root, components },
      },
    ],
  };
  if (!A2UI.validateBlobEntry(blob)) {
    throw new Error('invalid a2ui blob');
  }
  return blob;
}

export function serializeBlobField(entry: TlonA2UIBlob): string {
  return appendToPostBlob(undefined, entry);
}

/**
 * The one recorded tap on a reply, or null.
 *
 * Requires the blob to be exactly one `interactive-action` entry — the same
 * predicate clients use to hide such a reply. A reply carrying user content
 * alongside it is a real message, not a tap.
 */
export function readInteractiveAction(
  blob: string | null | undefined
): InteractiveActionEntry | null {
  if (!blob) {
    return null;
  }
  const entries = parsePostBlob(blob);
  if (entries.length !== 1) {
    return null;
  }
  const entry = entries[0];
  return entry.type === 'interactive-action' ? entry : null;
}

export type InteractiveActionEntry = Extract<
  ReturnType<typeof parsePostBlob>[number],
  { type: 'interactive-action' }
>;

/** The card's authoritative state, or null when it carries none yet. */
export function readSurfaceState(
  blob: string | null | undefined,
  surfaceId: string
): SurfaceState | null {
  const entry = findInteractiveSurface(blob, surfaceId);
  if (!entry) {
    return null;
  }
  return {
    surfaceId: entry.surfaceId,
    revision: entry.revision,
    state: entry.state as JsonObject,
    processedActionIds: entry.processedActionIds,
  };
}

/**
 * Rebuild a card's whole blob with new surface state.
 *
 * This exists so the rule gets applied in one place: %edit stores the essay
 * wholesale, so **any entry not re-emitted is erased**. An edit carrying only
 * the new surface entry would delete the card's own view from every member's
 * copy.
 *
 * It walks the *raw* JSON array rather than `parsePostBlob`, and that is
 * deliberate. The parser collapses anything it cannot validate to
 * `{type:'unknown'}`, which loses the original bytes — so rebuilding from
 * parsed entries would erase an entry written by a newer client, which is the
 * same destructive mistake this function exists to prevent. Only the matching
 * surface entry is replaced; every other entry is carried through verbatim.
 */
export function rebuildBlobWithSurface(
  blob: string | null | undefined,
  next: SurfaceState
): string {
  const nextEntry = {
    type: 'interactive-surface' as const,
    version: 1 as const,
    surfaceId: next.surfaceId,
    revision: next.revision,
    state: next.state,
    processedActionIds: next.processedActionIds.slice(
      -INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds
    ),
  };

  const existing = rawBlobEntries(blob);
  let replaced = false;
  const out = existing.map((entry) => {
    if (
      isRecord(entry) &&
      entry.type === 'interactive-surface' &&
      entry.surfaceId === next.surfaceId
    ) {
      replaced = true;
      return nextEntry;
    }
    return entry;
  });
  if (!replaced) {
    out.push(nextEntry);
  }
  return JSON.stringify(out);
}

/**
 * The blob's entries as they were written, unvalidated.
 *
 * A malformed blob yields nothing rather than throwing: refusing to update a
 * card because some unrelated entry is unreadable would be worse than carrying
 * on, and the surface entry we are writing is built here rather than read.
 */
function rawBlobEntries(blob: string | null | undefined): unknown[] {
  if (!blob) {
    return [];
  }
  try {
    const parsed = JSON.parse(blob);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
