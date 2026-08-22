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
 *   DM with ~x  → ~x's person files (both tiers) + that DM's own LCM
 *                 history (all session-family segments, threads included)
 *   channel     → the channel's place file, the current speaker's public
 *                 tier, and the channel's own LCM history
 *
 * Cross-surface transcript search is deliberately absent in v1 — it needs
 * seat-level audience containment (audienceContains) fed by group state
 * we don't snapshot yet. The digest already provides cross-channel
 * awareness; this provides depth on the current surface.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { selectMemoryFilePaths } from './bootstrap-loader.js';
import { type LcmSearchHit, searchLcmHistory } from './lcm-reader.js';
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

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
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
      'Search this conversation surface’s memory: durable facts about the ' +
      'current person and place, plus the full transcript history of THIS ' +
      'surface (including before session resets). Scope is enforced by the ' +
      'tool — it never returns content from other DMs or channels. ' +
      'Returns NONE when nothing relevant is found.',
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
        return textResult('Error: query is required.');
      }
      const sessionKey = deps.sessionKey?.trim();
      if (!sessionKey) {
        return textResult('NONE');
      }
      const surface = parseTlonSurface(sessionKey);
      if (!surface) {
        // Not a Tlon surface (webchat, cron, …): nothing is in scope.
        return textResult('NONE');
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
      const search = deps.searchHistory ?? searchLcmHistory;
      const limit = Math.min(Math.max(params.limit ?? 8, 1), 20);
      let hits: LcmSearchHit[] = [];
      try {
        hits = search({ baseSessionKeys: [baseKey], query, limit });
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
        return textResult('NONE');
      }
      const text = sections.join('\n');
      deps.log?.(
        `[tlon] recall: ${hits.length} history hits for ${describeSource(baseKey)}`
      );
      return textResult(
        text.length > MAX_OUTPUT_CHARS ? text.slice(0, MAX_OUTPUT_CHARS) : text
      );
    },
  };
}
