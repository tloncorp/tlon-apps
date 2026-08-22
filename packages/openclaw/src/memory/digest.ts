/**
 * Per-group activity digest: a shallow, standing summary of what the bot
 * has seen lately in each channel of a group, rendered into channel
 * sessions at bootstrap.
 *
 * This is a cue index, not memory — it exists so the bot knows something
 * happened in a sibling channel and can go read that conversation itself.
 * Design goals are therefore inverted from the memory files: complete
 * rather than selective, shallow rather than deep, staleness-tolerant.
 *
 * Audience rule (v1, provably safe): when rendering inside channel X, a
 * sibling row is included only if the sibling's reader set is empty (open
 * to every group member). Restricted siblings are omitted entirely —
 * naming them would leak their existence into rooms that can't see them.
 * The current channel is always included: its readers were admitted by
 * the backend.
 */
import { sharedMap } from '../shared-state.js';
import { getChannelIndexEntry, getGroupIndexEntry } from './group-index.js';

interface DigestEvent {
  timestamp: number;
  sender: string;
}

interface ChannelDigestState {
  events: DigestEvent[];
  latestSnippet?: string;
  latestTimestamp?: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_CHANNEL = 200;
const SNIPPET_MAX_CHARS = 80;
const MAX_RENDERED_ROWS = 24;

const digestState = sharedMap<string, ChannelDigestState>(
  'memory-digest-state'
);

function pruneWindow(state: ChannelDigestState, now: number): void {
  const cutoff = now - WINDOW_MS;
  while (state.events.length > 0 && state.events[0].timestamp < cutoff) {
    state.events.shift();
  }
  if (state.events.length > MAX_EVENTS_PER_CHANNEL) {
    state.events.splice(0, state.events.length - MAX_EVENTS_PER_CHANNEL);
  }
}

function toSnippet(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= SNIPPET_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}

/** Record an observed group message. Called from the channel firehose. */
export function recordDigestMessage(params: {
  nest: string;
  sender: string;
  text?: string;
  timestamp?: number;
}): void {
  const nest = params.nest?.trim();
  const sender = params.sender?.trim();
  if (!nest || !sender) {
    return;
  }
  const now = Date.now();
  const timestamp =
    typeof params.timestamp === 'number' &&
    Number.isFinite(params.timestamp) &&
    params.timestamp > 0
      ? Math.min(params.timestamp, now)
      : now;
  const state = digestState.get(nest) ?? { events: [] };
  state.events.push({ timestamp, sender });
  const snippet = params.text ? toSnippet(params.text) : '';
  if (snippet) {
    state.latestSnippet = snippet;
  }
  state.latestTimestamp = timestamp;
  pruneWindow(state, now);
  digestState.set(nest, state);
}

function channelLabel(nest: string): string {
  const entry = getChannelIndexEntry(nest);
  if (entry?.title) {
    return `#${entry.title}`;
  }
  const name = nest.split('/').pop();
  return name ? `#${name}` : nest;
}

function describeQuiet(latestTimestamp: number | undefined): string {
  if (!latestTimestamp) {
    return 'no activity seen';
  }
  const days = Math.floor(
    (Date.now() - latestTimestamp) / (24 * 60 * 60 * 1000)
  );
  if (days <= 0) {
    return 'quiet today';
  }
  return `quiet ${days}d`;
}

/**
 * Render the digest for the group containing `currentNest`, filtered for
 * that channel's audience. Returns null when the channel's group is
 * unknown (fail closed: no group, no digest) or nothing is renderable.
 */
export function renderGroupDigestForChannel(currentNest: string): {
  groupFlag: string;
  content: string;
} | null {
  const channelEntry = getChannelIndexEntry(currentNest);
  if (!channelEntry) {
    return null;
  }
  const group = getGroupIndexEntry(channelEntry.groupFlag);
  if (!group) {
    return null;
  }

  const rows: string[] = [];
  const quiet: string[] = [];
  for (const nest of group.channels.slice(0, 64)) {
    const isCurrent = nest === currentNest;
    const entry = getChannelIndexEntry(nest);
    // Audience rule: siblings must be open to all members; unknown fails
    // closed. The current channel is always safe to describe to itself.
    if (!isCurrent && (!entry || entry.readers.length > 0)) {
      continue;
    }
    const state = digestState.get(nest);
    if (state) {
      pruneWindow(state, Date.now());
    }
    const count = state?.events.length ?? 0;
    if (count > 0) {
      const senders = new Set(state!.events.map((event) => event.sender));
      const snippet = state!.latestSnippet
        ? ` · “${state!.latestSnippet}”`
        : '';
      rows.push(
        `- ${channelLabel(nest)} — ${count} msg${count === 1 ? '' : 's'} from ${senders.size} ship${senders.size === 1 ? '' : 's'} (24h)${snippet}`
      );
    } else {
      quiet.push(
        `${channelLabel(nest)} (${describeQuiet(state?.latestTimestamp)})`
      );
    }
    if (rows.length >= MAX_RENDERED_ROWS) {
      break;
    }
  }

  if (rows.length === 0 && quiet.length === 0) {
    return null;
  }

  const title = group.title ?? channelEntry.groupFlag;
  const lines = [
    `# Recent activity — ${title}`,
    '',
    'What you have seen in this group lately. To recall detail from another',
    'channel, read that channel with the tlon tool rather than guessing.',
    '',
    ...rows,
  ];
  if (quiet.length > 0) {
    lines.push('', `Quiet: ${quiet.join(', ')}`);
  }
  return { groupFlag: channelEntry.groupFlag, content: lines.join('\n') };
}

/** Test helper: reset shared state between tests. */
export function clearDigestStateForTest(): void {
  digestState.clear();
}
