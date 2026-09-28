/**
 * Records which ship most recently spoke in each session, so consumers that
 * only receive a session key (the agent:bootstrap hook, plugin tools called
 * by the active-memory sub-agent) can resolve the current speaker.
 *
 * In a DM the speaker is derivable from the session key itself; in a group
 * channel it is not — the monitor records it here on every inbound message.
 * Same sharedMap + TTL pattern as session-roles.ts.
 */
import { sharedMap } from '../shared-state.js';
import { stripActiveMemorySuffix, stripThreadSuffix } from './surface.js';

interface SpeakerEntry {
  ship: string;
  timestamp: number;
}

const sessionSpeakers = sharedMap<string, SpeakerEntry>('session-speakers');

// Speakers are consumed within the same turn they're recorded (bootstrap runs
// right after inbound routing), so a short TTL is plenty.
const SPEAKER_TTL_MS = 15 * 60 * 1000;

export function recordSpeakerForSession(
  sessionKey: string | null | undefined,
  ship: string | null | undefined
): void {
  const key = sessionKey?.trim();
  const speaker = ship?.trim();
  if (!key || !speaker) {
    return;
  }
  const now = Date.now();
  // Opportunistic cleanup, mirroring session-roles.ts.
  for (const [entryKey, entry] of sessionSpeakers) {
    if (now - entry.timestamp > SPEAKER_TTL_MS) {
      sessionSpeakers.delete(entryKey);
    }
  }
  sessionSpeakers.set(key, { ship: speaker, timestamp: now });
}

function lookup(sessionKey: string): string | undefined {
  const entry = sessionSpeakers.get(sessionKey);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.timestamp > SPEAKER_TTL_MS) {
    sessionSpeakers.delete(sessionKey);
    return undefined;
  }
  return entry.ship;
}

/**
 * Resolve the most recent speaker for a session key. Falls back through the
 * active-memory and thread suffixes so recall sub-agents and thread sessions
 * resolve to their parent surface's speaker.
 */
export function resolveSpeakerForSession(
  sessionKey: string | null | undefined
): string | undefined {
  const key = sessionKey?.trim();
  if (!key) {
    return undefined;
  }
  const direct = lookup(key);
  if (direct) {
    return direct;
  }
  const withoutRecall = stripActiveMemorySuffix(key);
  if (withoutRecall !== key) {
    const viaParent = lookup(withoutRecall);
    if (viaParent) {
      return viaParent;
    }
  }
  const withoutThread = stripThreadSuffix(withoutRecall);
  if (withoutThread !== withoutRecall) {
    return lookup(withoutThread);
  }
  return undefined;
}
