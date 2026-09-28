/**
 * agent:bootstrap hook: load subject-keyed memory files for the current
 * Tlon surface.
 *
 * Selection rules (see the design doc on TLON-6375):
 * - DM with ~x        → person/~x.md + person/~x.private.md
 * - channel, ~x spoke → place/<nest>.md + person/~x.md (public tier only —
 *                       the private tier never enters a surface with an
 *                       audience larger than its subject)
 * - thread            → same as its parent surface (inherits downward)
 *
 * Missing files are a silent no-op, so the feature rolls out by creating
 * files rather than by config. Enforcement is structural: what may not be
 * seen is never loaded.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { renderGroupDigestForChannel } from './digest.js';
import { resolveSpeakerForSession } from './speaker-bridge.js';
import { parseTlonSurface } from './surface.js';

const PERSON_SUBDIR = path.join('memory', 'person');
const PLACE_SUBDIR = path.join('memory', 'place');

// Defensive per-file cap; the host applies its own bootstrap budget on top.
const MAX_FILE_CHARS = 16_000;

const SHIP_FILE_RE = /^~[a-z-]+$/;
const NEST_RE = /^(chat|heap|diary)\/(~[a-z-]+)\/([a-z0-9.-]+)$/;

type BootstrapFileEntry = {
  name: string;
  path: string;
  content?: string;
  missing: boolean;
};

type AgentBootstrapContext = {
  workspaceDir?: string;
  bootstrapFiles?: BootstrapFileEntry[];
  sessionKey?: string;
};

type InternalHookEventLike = {
  type?: string;
  action?: string;
  context?: AgentBootstrapContext;
};

/** Encode a channel nest as a flat filename: chat/~zod/general → chat.~zod.general */
export function encodeNestForFilename(nest: string): string | null {
  const match = NEST_RE.exec(nest);
  if (!match) {
    return null;
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

async function readMemoryFile(
  workspaceDir: string,
  relPath: string
): Promise<BootstrapFileEntry | null> {
  const absPath = path.resolve(workspaceDir, relPath);
  // Belt-and-suspenders: inputs are regex-validated, but never load outside
  // the workspace regardless.
  if (!absPath.startsWith(path.resolve(workspaceDir) + path.sep)) {
    return null;
  }
  let content: string;
  try {
    content = await fs.readFile(absPath, 'utf8');
  } catch {
    return null;
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  return {
    name: relPath,
    path: absPath,
    content:
      trimmed.length > MAX_FILE_CHARS
        ? trimmed.slice(0, MAX_FILE_CHARS)
        : trimmed,
    missing: false,
  };
}

/** Compute the workspace-relative memory file paths for a session. */
export function selectMemoryFilePaths(sessionKey: string): string[] {
  const surface = parseTlonSurface(sessionKey);
  if (!surface) {
    return [];
  }
  if (surface.kind === 'dm') {
    if (!SHIP_FILE_RE.test(surface.ship)) {
      return [];
    }
    return [
      path.join(PERSON_SUBDIR, `${surface.ship}.md`),
      path.join(PERSON_SUBDIR, `${surface.ship}.private.md`),
    ];
  }
  const paths: string[] = [];
  const encodedNest = encodeNestForFilename(surface.nest);
  if (encodedNest) {
    paths.push(path.join(PLACE_SUBDIR, `${encodedNest}.md`));
  }
  const speaker = resolveSpeakerForSession(sessionKey);
  if (speaker && SHIP_FILE_RE.test(speaker)) {
    paths.push(path.join(PERSON_SUBDIR, `${speaker}.md`));
  }
  return paths;
}

/** Create the agent:bootstrap handler that appends memory files in place. */
export function createMemoryBootstrapHandler(opts?: {
  log?: (message: string) => void;
}) {
  return async (event: InternalHookEventLike): Promise<void> => {
    if (event?.type !== 'agent' || event?.action !== 'bootstrap') {
      return;
    }
    const context = event.context;
    const workspaceDir = context?.workspaceDir;
    const bootstrapFiles = context?.bootstrapFiles;
    const sessionKey = context?.sessionKey?.trim();
    if (!workspaceDir || !Array.isArray(bootstrapFiles) || !sessionKey) {
      return;
    }
    const relPaths = selectMemoryFilePaths(sessionKey);
    const alreadyLoaded = new Set(
      bootstrapFiles.map((file) => file.path ?? file.name)
    );
    for (const relPath of relPaths) {
      const entry = await readMemoryFile(workspaceDir, relPath);
      if (!entry || alreadyLoaded.has(entry.path)) {
        continue;
      }
      bootstrapFiles.push(entry);
      alreadyLoaded.add(entry.path);
      opts?.log?.(`[tlon] memory: loaded ${relPath} for ${sessionKey}`);
    }

    // Group digest: rendered live (never persisted), rows already filtered
    // for this channel's audience inside renderGroupDigestForChannel.
    const surface = parseTlonSurface(sessionKey);
    if (surface?.kind === 'channel') {
      const digest = renderGroupDigestForChannel(surface.nest);
      if (digest) {
        const flatFlag = digest.groupFlag.replace(/\//g, '.');
        const name = path.join('memory', 'digest', `${flatFlag}.md`);
        const virtualPath = path.resolve(workspaceDir, name);
        if (!alreadyLoaded.has(virtualPath)) {
          bootstrapFiles.push({
            name,
            path: virtualPath,
            content: digest.content.slice(0, MAX_FILE_CHARS),
            missing: false,
          });
          opts?.log?.(
            `[tlon] memory: rendered digest for ${digest.groupFlag} into ${sessionKey}`
          );
        }
      }
    }
  };
}
