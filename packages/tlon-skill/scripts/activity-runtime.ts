import {
  type PostContent,
  activityAction,
  adjustVolumeSetting,
  getChannelPosts,
  getCurrentUserId,
  getGroupAndChannelUnreads,
  getGroups,
  getInitialActivity,
  getTextContent,
  getVolumeSettings,
  poke,
  readChannel,
  setActivitySupportsNotes,
  setActivitySupportsReactions,
} from '@tloncorp/api';
import {
  NotificationNamesShort,
  type Source,
  type VolumeMap,
  getDefaultVolumeOption,
  getLevelFromVolumeMap,
  getVolumeMap,
  sourceToString,
} from '@tloncorp/api/urbit';

import { ensureClient } from './api-client';
import { getChannelState } from './channel-state-runtime';
import { formatPostId } from './cli-utils';
import type {
  ActivityDeps,
  ActivityEvent,
  ActivityFormatter,
  MarkReadTarget,
  PokeOutcome,
  RootPost,
  VolumeHelpers,
} from './commands/activity';
import { commandError, errorMessage } from './commands/command';
import { createProcessCommandDeps } from './runtime-deps';

function extractText(content: unknown): string {
  if (!content) return '';
  const text = getTextContent(content as PostContent);
  return text || '';
}

function formatAge(ms: number): string {
  if (ms < 60 * 1000) return 'just now';
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Activity event timestamps arrive from @tloncorp/api as unix ms.
export function formatActivityTime(timestamp: number, now: number): string {
  if (!Number.isFinite(timestamp)) return 'unknown';
  const iso = new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${iso} (${formatAge(Math.max(0, now - timestamp))})`;
}

export function formatEvent(event: ActivityEvent, now: number): string {
  const lines: string[] = [];
  const timeStr = formatActivityTime(event.timestamp, now);

  if (event.type === 'post') {
    const author = event.authorId || 'unknown';
    const text = extractText(event.content);
    const mention = event.isMention ? ' [MENTION]' : '';
    lines.push(`📝 Post${mention} by ${author} in ${event.channelId}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(
      `   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
    );
  }

  if (event.type === 'reply') {
    const author = event.authorId || 'unknown';
    const text = extractText(event.content);
    const mention = event.isMention ? ' [MENTION]' : '';
    lines.push(`💬 Reply${mention} by ${author} in ${event.channelId}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(
      `   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
    );
  }

  if (event.type === 'dm-post') {
    const author = event.authorId || 'unknown';
    const text = extractText(event.content);
    const mention = event.isMention ? ' [MENTION]' : '';
    lines.push(`📨 DM${mention} from ${author}`);
    if (event.channelId) lines.push(`   To: ${event.channelId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(
      `   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
    );
  }

  if (event.type === 'dm-reply') {
    const author = event.authorId || 'unknown';
    const text = extractText(event.content);
    const mention = event.isMention ? ' [MENTION]' : '';
    lines.push(`💬 DM Reply${mention} from ${author}`);
    if (event.channelId) lines.push(`   To: ${event.channelId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(
      `   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
    );
  }

  if (event.type === 'group-ask') {
    lines.push(`🙋 Join request from ${event.groupEventUserId || 'unknown'}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }

  if (event.type === 'group-join') {
    lines.push(`👋 ${event.groupEventUserId || 'unknown'} joined`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }

  if (event.type === 'group-invite') {
    lines.push(`📩 Invite from ${event.groupEventUserId || 'unknown'}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }

  if (event.type === 'contact') {
    lines.push(`👤 Contact update from ${event.contactUserId || 'unknown'}`);
    if (event.contactUpdateType) {
      lines.push(`   Update: ${event.contactUpdateType}`);
    }
    lines.push(`   Time: ${timeStr}`);
  }

  return lines.join('\n');
}

function createActivityFormatter(): ActivityFormatter {
  return {
    activityHeader: (bucket, count) =>
      `\n=== ${bucket.toUpperCase()} (${count} events) ===\n`,
    noActivity: (bucket) => `No ${bucket} activity found.`,
    event: (event) => formatEvent(event, Date.now()),
    unreadsHeader: (ship) => `\n=== UNREADS for ${ship} ===\n`,
    noUnreads: () => 'No unreads!',
    baseUnread: (summary) => {
      const notify = summary.notify ? '🔔' : '';
      return `${notify} base\n   Count: ${summary.count ?? 0}, Notify count: ${summary.notifyCount ?? 0}`;
    },
    groupUnread: (summary) => {
      const notify = summary.notify ? '🔔' : '';
      return `${notify} group/${summary.groupId}\n   Count: ${summary.count ?? 0}, Notify count: ${summary.notifyCount ?? 0}`;
    },
    channelUnread: (summary) => {
      const notify = summary.notify ? '🔔' : '';
      const lines = [
        `${notify} channel/${summary.channelId}`,
        `   Count: ${summary.count ?? 0}, Notify count: ${summary.countWithoutThreads ?? 0}`,
      ];
      if (summary.firstUnreadPostId) {
        lines.push(`   First unread: ${summary.firstUnreadPostId}`);
      }
      return lines.join('\n');
    },
  };
}

// Every supported desk (>= the 12.2.0 floor) serves activity-action-2 and
// /v6/volume-settings, but the CLI never runs the app's version sync that
// sets these flags. Without them the poke uses the v8 mark, which strips the
// react and note keys, so older loud entries for those would keep notifying
// after a mute. Set per call: idempotent, and survives a client reset.
function enableCurrentActivityEndpoints(): void {
  setActivitySupportsReactions(true);
  setActivitySupportsNotes(true);
}

// eyre reports a nack as its `err` value, not an Error; anything thrown as an
// Error (reaped channel, ack timeout, transport) is ambiguous.
function classifyPokeError(error: unknown): PokeOutcome {
  return error instanceof Error
    ? { kind: 'ambiguous', message: error.message }
    : { kind: 'nacked', message: String(error) };
}

export async function adjustVolume(
  source: Source,
  volume: VolumeMap | null
): Promise<PokeOutcome> {
  enableCurrentActivityEndpoints();
  try {
    await adjustVolumeSetting(source, volume);
    return { kind: 'acked' };
  } catch (error) {
    return classifyPokeError(error);
  }
}

// Group and base reads send the payload readGroup/readAll build, but once:
// their backOff retry would outlast the harness's CLI timeout after an ack
// timeout and resend a poke the ship may already have taken. The read-back
// settles an ambiguous outcome instead.
function pokeDeepRead(source: Source): Promise<unknown> {
  return poke(
    activityAction({
      read: { source, action: { all: { time: null, deep: true } } },
    })
  );
}

export async function markRead(target: MarkReadTarget): Promise<PokeOutcome> {
  enableCurrentActivityEndpoints();
  try {
    switch (target.kind) {
      case 'dm-ship':
        await readChannel({
          channelId: target.ship,
          channelType: 'dm',
          deep: true,
        });
        break;
      case 'dm-club':
        await readChannel({
          channelId: target.club,
          channelType: 'groupDm',
          deep: true,
        });
        break;
      case 'channel':
        await readChannel({
          channelId: target.nest,
          channelType: target.nest.startsWith('heap/') ? 'gallery' : 'chat',
          groupId: target.groupId,
          deep: true,
        });
        break;
      case 'group':
        await pokeDeepRead({ group: target.flag });
        break;
      case 'all':
        await pokeDeepRead({ base: null });
        break;
    }
    return { kind: 'acked' };
  } catch (error) {
    return classifyPokeError(error);
  }
}

// /v6/activity carries notebook sources; without the flags the api falls back
// to /v4, which drops them.
export async function readUnreads() {
  enableCurrentActivityEndpoints();
  try {
    return await getGroupAndChannelUnreads();
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

export async function readVolumeSettings() {
  enableCurrentActivityEndpoints();
  try {
    return await getVolumeSettings();
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

export async function findRootPost(
  nest: string,
  id: string
): Promise<RootPost | null> {
  let result: Awaited<ReturnType<typeof getChannelPosts>>;
  try {
    result = await getChannelPosts({
      channelId: nest,
      cursor: id,
      mode: 'around',
      count: 1,
      includeReplies: false,
    });
  } catch (error) {
    throw commandError(errorMessage(error));
  }
  const post = result.posts.find(
    (candidate) => !candidate.parentId && formatPostId(candidate.id) === id
  );
  return post
    ? { id, authorId: post.authorId, isDeleted: !!post.isDeleted }
    : null;
}

async function isJoinedGroup(flag: string): Promise<boolean> {
  try {
    const groups = await getGroups();
    return groups.some((group) => group.id === flag);
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

export const volumeHelpers: VolumeHelpers = {
  mapForLevel: (level) => getVolumeMap(level, true),
  levelOf: getLevelFromVolumeMap,
  sourceKey: (source) => sourceToString(source),
  inheritedLevel: getDefaultVolumeOption,
  // `medium`'s short name carries a trailing space that only disambiguates it
  // from `default` inside the app's enum.
  levelName: (level) => NotificationNamesShort[level].trim(),
};

export function createActivityDeps(): ActivityDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      await ensureClient();
    },
    activityApi: {
      getInitialActivity: async () => {
        const result = await getInitialActivity();
        return { events: result.events };
      },
      getGroupAndChannelUnreads: async () => {
        return getGroupAndChannelUnreads();
      },
    },
    format: createActivityFormatter(),
    volumeApi: {
      adjustVolumeSetting: adjustVolume,
      getVolumeSettings: readVolumeSettings,
    },
    volume: volumeHelpers,
    readApi: {
      markRead,
      getUnreads: readUnreads,
    },
    isJoinedGroup,
    getChannelState,
    findRootPost,
    getCurrentUserId: () => getCurrentUserId(),
    sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  };
}
