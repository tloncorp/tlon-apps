/**
 * Attachment scopes — the grammar shared with the OpenClaw plugin's
 * `externalClaims` settings entry. A scope names a slice of the bot's
 * conversation surface that this local session takes over:
 *
 *   ~sampel-palnet                 one-to-one DM with a ship
 *   0v5.abcde...                   group DM (club id)
 *   chat/~host/slug                a whole group channel
 *   chat/~host/slug/170.141...     a single thread (top-level post id)
 */
import { normalizeShip } from './config.js';

export type Scope =
  | { kind: 'dm'; ship: string }
  | { kind: 'club'; id: string }
  | { kind: 'channel'; nest: string }
  | { kind: 'thread'; nest: string; parentId: string };

/** Strip @ud dot-grouping so post ids compare regardless of formatting. */
export function normalizePostId(id: string): string {
  return id.replace(/\./g, '');
}

export function parseScope(raw: string): Scope | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed.startsWith('~')) {
    return { kind: 'dm', ship: normalizeShip(trimmed) };
  }
  if (trimmed.startsWith('0v')) {
    return { kind: 'club', id: trimmed };
  }
  const parts = trimmed.split('/');
  if (parts.length === 3 && parts[1].startsWith('~')) {
    return {
      kind: 'channel',
      nest: `${parts[0]}/${parts[1].toLowerCase()}/${parts[2]}`,
    };
  }
  if (parts.length === 4 && parts[1].startsWith('~')) {
    return {
      kind: 'thread',
      nest: `${parts[0]}/${parts[1].toLowerCase()}/${parts[2]}`,
      parentId: normalizePostId(parts[3]),
    };
  }
  return null;
}

export function scopeKey(scope: Scope): string {
  switch (scope.kind) {
    case 'dm':
      return scope.ship;
    case 'club':
      return scope.id;
    case 'channel':
      return scope.nest;
    case 'thread':
      return `${scope.nest}/${scope.parentId}`;
  }
}

/** Inbound-message coordinates used for scope matching. */
export type MessageLocus = {
  /** DM counterparty (`~ship`) or club id (`0v...`); unset for group channels */
  whom?: string;
  /** Channel nest for group-channel messages */
  nest?: string;
  /** Top-level post id when the message is a thread reply */
  parentId?: string | null;
};

/**
 * Return the attached scope covering this locus, or undefined. A channel
 * scope covers the whole channel including threads; a thread scope covers
 * only replies under that top-level post.
 */
export function matchScope(
  scopes: Iterable<Scope>,
  locus: MessageLocus
): Scope | undefined {
  const normalizedParent = locus.parentId
    ? normalizePostId(locus.parentId)
    : undefined;
  for (const scope of scopes) {
    switch (scope.kind) {
      case 'dm':
        if (locus.whom && normalizeShip(locus.whom) === scope.ship) {
          return scope;
        }
        break;
      case 'club':
        if (locus.whom === scope.id) {
          return scope;
        }
        break;
      case 'channel':
        if (locus.nest === scope.nest) {
          return scope;
        }
        break;
      case 'thread':
        if (
          locus.nest === scope.nest &&
          normalizedParent !== undefined &&
          normalizedParent === scope.parentId
        ) {
          return scope;
        }
        break;
    }
  }
  return undefined;
}
