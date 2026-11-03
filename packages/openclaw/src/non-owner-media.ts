/**
 * Outbound media rule for non-owner turns: remote https media is allowed,
 * everything else (local paths, data:, http:, the ship's own host, internal
 * names) is not. The before_tool_call hook applies it to the `message` tool's
 * arguments and to the media core resolves from the body; the Tlon adapter
 * and uploader apply it to the payload core actually resolved.
 *
 * The role comes from the active Tlon turn (AsyncLocalStorage set around the
 * monitor's dispatch): the answered sender's role or the run's sticky demotion
 * (turn-identity.ts). The session's current role is not consulted: the
 * monitor overwrites it on every inbound message, so in a group another
 * member's post would reclassify an owner's in-flight turn. Outside a Tlon
 * turn (cron, heartbeat, durable redelivery) there is no requester and media
 * passes, matching the hook's role-less rule.
 */
import { isIP } from 'node:net';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

import { getActiveTlonTurnRequester } from './turn-recorder.js';
import { getRecordedRunRole } from './turn-identity.js';

export const NON_OWNER_MEDIA_ERROR =
  'Local and internal media are owner-only for this conversation; send text or a public https URL.';

const logger = createSubsystemLogger('tlon/non-owner-media');
const loggedRuns = new Set<string>();
const MAX_LOGGED_RUNS = 1_024;

/**
 * Most attachments core may fetch for one non-owner `message` call (keys and
 * body together, deduplicated as core delivers them); each can be a 10 MiB
 * download.
 */
export const NON_OWNER_MAX_MEDIA_REFS = 4;

/**
 * Most image blocks one non-owner message may render through Tlon's story
 * converter; markdown images are links, not downloads, so the cap is looser.
 */
export const NON_OWNER_MAX_IMAGE_BLOCKS = 8;

export type NonOwnerMediaContext = {
  /** The live config; its Tlon accounts' ship hosts are never allowed. */
  cfg: OpenClawConfig | undefined;
};

// Names that resolve inside the gateway's own network rather than on the
// public internet (`.cluster.local` is covered by `.local`).
const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.svc'];

function normalizeHost(hostname: string): string {
  // URL.hostname is already lowercased and punycoded; drop trailing dots so
  // `example.com.` and `example.com` compare equal.
  return hostname.toLowerCase().replace(/\.+$/, '');
}

function hostOf(url: string): string | undefined {
  for (const candidate of [url, `https://${url}`]) {
    try {
      const host = normalizeHost(new URL(candidate).hostname);
      if (host) return host;
    } catch {
      // Try the next shape.
    }
  }
  return undefined;
}

// Read straight from the config rather than through types.ts so every
// account's URL counts, configured ship or not.
function shipHosts(cfg: OpenClawConfig): Set<string> {
  const tlon = cfg.channels?.tlon as
    | {
        url?: unknown;
        accounts?: Record<string, { url?: unknown } | undefined>;
      }
    | undefined;
  const urls = [
    tlon?.url,
    ...Object.values(tlon?.accounts ?? {}).map((account) => account?.url),
  ];
  const hosts = new Set<string>();
  for (const url of urls) {
    const host = typeof url === 'string' ? hostOf(url.trim()) : undefined;
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * Whether a non-owner turn may send this media reference: a literal https URL
 * with no credentials whose host is not localhost, an IP literal, an internal
 * or single-label name, or a configured Tlon ship's host. Private addresses
 * behind public names are the fetch's SSRF guard's job. Without a config the
 * ship hosts are unknown, so nothing passes.
 */
export function isNonOwnerMediaAllowed(
  ref: string,
  ctx: NonOwnerMediaContext
): boolean {
  if (!ctx.cfg) return false;
  const value = ref.trim();
  // A literal `https://` and an authority: `https:host` and `https:/host`
  // parse as URLs, but core loads them as local paths.
  if (!/^https:\/\/[^/\\]/i.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Any userinfo, including an empty one the WHATWG parser drops
  // (`https://@host`).
  if (url.protocol !== 'https:' || /^https:\/\/[^/?#\\]*@/i.test(value)) {
    return false;
  }
  const host = normalizeHost(url.hostname);
  if (!host || host.startsWith('[') || isIP(host) !== 0) return false;
  // Single-label names (`localhost`, cluster services through search
  // domains) never name a public host.
  if (!host.includes('.')) return false;
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  return !shipHosts(ctx.cfg).has(host);
}

function activeNonOwnerTurn(): { runId: string; sessionKey: string } | null {
  const turn = getActiveTlonTurnRequester();
  if (!turn) return null;
  // getRecordedRunRole is the security hook's sticky record: a non-owner
  // message steered into this run demotes it to 'user' for good. The
  // session's current role is deliberately ignored (see header).
  const nonOwner =
    turn.senderRole === 'user' || getRecordedRunRole(turn.runId) === 'user';
  return nonOwner ? turn : null;
}

/**
 * The active turn's media decision, taken once: every reference passes
 * outside a non-owner turn, only references passing the rule inside one. A
 * caller that checks references later (redirect hops of a download that
 * outlives the turn) keeps this snapshot instead of re-reading the turn.
 * Logs once per run when a reference is refused.
 */
export function activeTurnMediaGate(
  ctx: NonOwnerMediaContext
): (ref: string) => boolean {
  const turn = activeNonOwnerTurn();
  if (!turn) return () => true;
  return (ref) => {
    if (isNonOwnerMediaAllowed(ref, ctx)) return true;
    if (!loggedRuns.has(turn.runId)) {
      loggedRuns.add(turn.runId);
      if (loggedRuns.size > MAX_LOGGED_RUNS) {
        loggedRuns.delete(loggedRuns.values().next().value!);
      }
      logger.info(
        `Dropped outbound media for a non-owner turn. Session: ${turn.sessionKey}`
      );
    }
    return false;
  };
}

/** The media the active turn may send (see activeTurnMediaGate). */
export function filterActiveTurnMedia(
  refs: readonly string[],
  ctx: NonOwnerMediaContext
): { kept: string[]; dropped: boolean } {
  if (refs.length === 0) return { kept: [], dropped: false };
  const kept = refs.filter(activeTurnMediaGate(ctx));
  return { kept, dropped: kept.length < refs.length };
}
