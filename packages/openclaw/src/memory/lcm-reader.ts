/**
 * Read-only access to Lossless Claw's SQLite database (lcm.db) for
 * audience-scoped transcript recall.
 *
 * LCM keys conversations by session key, one row per session-family
 * segment (archived rows share the key), and keeps every raw message in
 * an FTS5-indexed table. Reading it directly is what lets tlon_recall
 * search a surface's own history — including across resets and archived
 * segments — without lcm_grep's one-conversation-or-everything scoping.
 *
 * Coupling note: this reads lossless-claw's schema (verified against
 * 0.15.x: conversations / messages / messages_fts). tlonbot pins the LCM
 * version; every query here degrades to an empty result on any schema
 * mismatch rather than throwing into the reply path.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

export interface LcmSearchHit {
  sessionKey: string;
  role: string;
  content: string;
  createdAt: string;
}

export function resolveLcmDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.LCM_DATABASE_PATH?.trim();
  if (explicit) {
    return explicit;
  }
  const stateDir =
    env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), '.openclaw');
  return path.join(stateDir, 'lcm.db');
}

/**
 * Turn a free-text query into a safe FTS5 MATCH expression: each term
 * double-quoted (FTS5 phrase syntax, immune to operator injection),
 * terms implicitly ANDed. Returns null when nothing searchable remains.
 */
export function toFtsQuery(query: string): string | null {
  const terms = query
    .split(/[^\p{L}\p{N}~-]+/u)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (terms.length === 0) {
    return null;
  }
  return terms.map((term) => `"${term.replaceAll('"', '')}"`).join(' ');
}

/**
 * Search raw messages within the conversations belonging to the given
 * session keys (exact matches) and their thread children (prefix
 * matches). Missing database, missing tables, or any schema mismatch
 * returns [].
 */
export function searchLcmHistory(params: {
  baseSessionKeys: string[];
  query: string;
  limit?: number;
  dbPath?: string;
}): LcmSearchHit[] {
  const dbPath = params.dbPath ?? resolveLcmDbPath();
  const ftsQuery = toFtsQuery(params.query);
  const baseKeys = params.baseSessionKeys.filter(Boolean);
  if (!ftsQuery || baseKeys.length === 0 || !fs.existsSync(dbPath)) {
    return [];
  }
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);

  let db: import('node:sqlite').DatabaseSync | undefined;
  try {
    // Lazy require keeps the experimental-module warning out of startup
    // and off every code path that never touches recall.
    const { DatabaseSync } =
      require('node:sqlite') as typeof import('node:sqlite');
    db = new DatabaseSync(dbPath, { readOnly: true });

    const keyClauses = baseKeys
      .map(() => '(session_key = ? OR session_key LIKE ?)')
      .join(' OR ');
    const keyParams = baseKeys.flatMap((key) => [key, `${key}:thread:%`]);
    const conversations = db
      .prepare(
        `SELECT conversation_id, session_key FROM conversations WHERE ${keyClauses}`
      )
      .all(...keyParams) as { conversation_id: number; session_key: string }[];
    if (conversations.length === 0) {
      return [];
    }
    const sessionKeyByConversation = new Map(
      conversations.map((row) => [row.conversation_id, row.session_key])
    );
    const idList = conversations.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT m.conversation_id, m.role, m.content, m.created_at
         FROM messages_fts f
         JOIN messages m ON m.message_id = f.rowid
         WHERE messages_fts MATCH ?
           AND m.conversation_id IN (${idList})
           AND m.role IN ('user', 'assistant')
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(
        ftsQuery,
        ...conversations.map((row) => row.conversation_id),
        limit
      ) as {
      conversation_id: number;
      role: string;
      content: string;
      created_at: string;
    }[];
    return rows.map((row) => ({
      sessionKey: sessionKeyByConversation.get(row.conversation_id) ?? '',
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  } catch {
    // Schema drift, malformed FTS state, locked db: recall degrades to
    // "nothing found" rather than failing the reply path.
    return [];
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}
