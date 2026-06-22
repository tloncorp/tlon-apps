import {
  type PostContent,
  getGroupAndChannelUnreads,
  getInitialActivity,
  getTextContent,
} from '@tloncorp/api';

import { ensureClient } from './api-client';
import type {
  ActivityDeps,
  ActivityEvent,
  ActivityFormatter,
} from './commands/activity';

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

function extractText(content: unknown): string {
  if (!content) return '';
  const text = getTextContent(content as PostContent);
  return text || '';
}

function formatActivityTime(timeStr: string | number): string {
  try {
    const str = String(timeStr);
    const daNum = BigInt(str.replace(/\./g, ''));
    const daSecond = BigInt('18446744073709551616');
    const daUnixEpoch = BigInt('170141184475152167957503069145530368000');

    const offset = daSecond / BigInt(2000);
    const epochAdjusted = offset + (daNum - daUnixEpoch);
    const unixMs = Math.round(
      Number((epochAdjusted * BigInt(1000)) / daSecond)
    );

    const date = new Date(unixMs);
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return 'unknown date';
  } catch {
    return 'unknown';
  }
}

function formatEvent(event: ActivityEvent): string {
  const lines: string[] = [];
  const timeStr = formatActivityTime(event.timestamp);

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
    event: formatEvent,
    unreadsHeader: () => '\n=== UNREADS ===\n',
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
  };
}
