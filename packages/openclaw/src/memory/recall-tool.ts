/**
 * tlon_recall: audience-gated recall over memory files and LCM transcript
 * history, designed to be the ONLY tool active-memory's blocking sub-agent
 * may call (`toolsAllow: ["tlon_recall"]`).
 *
 * The gate is structural, not judgment: the tool resolves the surface it
 * serves from the calling session key (the active-memory sub-agent's key
 * is its parent's plus a suffix) and searches only what that surface's
 * audience may see:
 *
 *   DM with ~x  → ~x's person files (both tiers), that DM's own LCM
 *                 history, and every channel ~x can read (the audience is
 *                 exactly ~x, who was entitled to all of it)
 *   channel     → the channel's place file, the current speaker's public
 *                 tier, the channel's own LCM history, and siblings whose
 *                 reader roles contain this channel's
 *
 * Scope derivation lives in recall-scope.ts (audience containment) and
 * fails closed on anything the group index cannot vouch for.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { selectMemoryFilePaths } from './bootstrap-loader.js';
import { type LcmSearchHit, searchLcmHistory } from './lcm-reader.js';
import { buildRecallSessionKeys } from './recall-scope.js';
import {
  parseTlonSurface,
  stripActiveMemorySuffix,
  stripThreadSuffix,
} from './surface.js';

const MAX_OUTPUT_CHARS = 6_000;
const SNIPPET_CHARS = 240;

export interface RecallDeps {
  /** Injectable for tests; defaults to the real lcm.db search. */
  searchHistory?: typeof searchLcmHistory;
  workspaceDir?: string;
  sessionKey?: string;
  log?: (message: string) => void;
}

type RecallStatus = 'ok' | 'no_results' | 'error';

// `details.status` doubles as active-memory's structured-result protocol:
// 'no_results' / 'error' tell the recall sub-agent this output is not
// recall evidence, so a literal NONE never gets injected as context.
function textResult(
  text: string,
  details: { status: RecallStatus; historyHits?: number } = { status: 'ok' }
) {
  return { content: [{ type: 'text' as const, text }], details };
}

function snippet(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length <= SNIPPET_CHARS
    ? singleLine
    : `${singleLine.slice(0, SNIPPET_CHARS - 1)}…`;
}

function describeSource(sessionKey: string): string {
  const surface = parseTlonSurface(sessionKey);
  if (!surface) {
    return sessionKey;
  }
  if (surface.kind === 'dm') {
    return surface.threadId
      ? `DM ${surface.ship} (thread)`
      : `DM ${surface.ship}`;
  }
  return surface.threadId ? `${surface.nest} (thread)` : surface.nest;
}

async function searchMemoryFiles(
  workspaceDir: string,
  relPaths: string[],
  query: string
): Promise<string[]> {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}~-]+/u)
    .filter(Boolean);
  if (terms.length === 0) {
    return [];
  }
  const lines: string[] = [];
  for (const relPath of relPaths) {
    let content: string;
    try {
      content = await fs.readFile(path.resolve(workspaceDir, relPath), 'utf8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      const lower = line.toLowerCase();
      if (terms.some((term) => lower.includes(term)) && line.trim()) {
        lines.push(`- [${relPath}] ${snippet(line)}`);
        if (lines.length >= 6) {
          return lines;
        }
      }
    }
  }
  return lines;
}

/** Build the tlon_recall tool for one session context. */
export function createTlonRecallTool(deps: RecallDeps) {
  return {
    name: 'tlon_recall',
    label: 'Tlon Recall',
    description:
      'Search everything this conversation’s audience may see: durable ' +
      'facts about the current person and place, this surface’s full ' +
      'transcript history (including before session resets), and — in a ' +
      'DM — the channels this person can read; in a channel, siblings its ' +
      'whole audience can read. Scope is enforced by the tool: it never ' +
      'returns other people’s DMs or channels the current audience cannot ' +
      'read. Returns NONE when nothing relevant is found.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            '1–4 distinctive keywords for what to recall (names, topics, ' +
            'identifiers). Not a sentence.',
        },
        limit: {
          type: 'number',
          description: 'Max transcript matches to return (default 8, max 20).',
        },
      },
      required: ['query'],
    },
    execute: async (
      _callId: string,
      params: { query?: string; limit?: number }
    ) => {
      const query = params.query?.trim();
      if (!query) {
        return textResult('Error: query is required.', { status: 'error' });
      }
      const sessionKey = deps.sessionKey?.trim();
      if (!sessionKey) {
        return textResult('NONE', { status: 'no_results' });
      }
      const surface = parseTlonSurface(sessionKey);
      if (!surface) {
        // Not a Tlon surface (webchat, cron, …): nothing is in scope.
        return textResult('NONE', { status: 'no_results' });
      }

      const sections: string[] = [];

      if (deps.workspaceDir) {
        const fileLines = await searchMemoryFiles(
          deps.workspaceDir,
          selectMemoryFilePaths(sessionKey),
          query
        );
        if (fileLines.length > 0) {
          sections.push('## Memory files', ...fileLines);
        }
      }

      // Surface base: recall sub-agent and thread suffixes both resolve to
      // the parent surface; the LIKE clause in the reader then re-includes
      // every thread under it (a thread inherits its channel's history).
      const baseKey = stripThreadSuffix(stripActiveMemorySuffix(sessionKey));
      // Audience-containment scope (v2): the surface's own history plus
      // every source this surface's audience is entitled to — a DM spans
      // the channels its ship can read, a channel spans qualifying
      // siblings. Falls back to the surface itself when the group index
      // is empty (unit tests, or before discovery has populated it).
      const scopedKeys = buildRecallSessionKeys(baseKey);
      const baseSessionKeys = scopedKeys.length > 0 ? scopedKeys : [baseKey];
      const search = deps.searchHistory ?? searchLcmHistory;
      const limit = Math.min(Math.max(params.limit ?? 8, 1), 20);
      let hits: LcmSearchHit[] = [];
      try {
        hits = search({ baseSessionKeys, query, limit });
      } catch {
        hits = [];
      }
      if (hits.length > 0) {
        sections.push(
          '## This surface’s history',
          ...hits.map(
            (hit) =>
              `- [${describeSource(hit.sessionKey)} · ${hit.createdAt} · ${hit.role}] ${snippet(hit.content)}`
          )
        );
      }

      if (sections.length === 0) {
        return textResult('NONE', { status: 'no_results' });
      }
      const text = sections.join('\n');
      deps.log?.(
        `[tlon] recall: ${hits.length} history hits for ${describeSource(baseKey)}`
      );
      return textResult(
        text.length > MAX_OUTPUT_CHARS ? text.slice(0, MAX_OUTPUT_CHARS) : text,
        { status: 'ok', historyHits: hits.length }
      );
    },
  };
}
