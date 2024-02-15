import _ from 'lodash';
import { useSkeins } from '@/state/hark';
import { Flag, Rope, Skein, Yarn } from '@/types/hark';
import { makePrettyDay } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';

export interface DayGrouping {
  date: string;
  latest: number;
  skeins: Skein[];
}

function groupSkeinsByDate(skeins: Skein[]): DayGrouping[] {
  const groups = _.groupBy(skeins, (b) => makePrettyDay(new Date(b.time)));

  return Object.entries(groups)
    .map(([k, v]) => ({
      date: k,
      latest: _.head(v)?.time || 0,
      skeins: v.sort((a, b) => b.time - a.time),
    }))
    .sort((a, b) => b.latest - a.latest);
}

export const getUrlInContent = (yarn: Yarn) =>
  yarn.con.find((c) => typeof c === 'string' && c.startsWith('http'));

export const isMessage = (yarn: Yarn) => yarn.con.some((con) => con === ': ');

export const isNote = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' published a note: ');

export const isBlock = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' posted a block to a gallery ');

export const isMention = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' mentioned you :');

export const isComment = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' commented on ');

export const isReply = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' replied to your message “');

export const isInvite = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' sent you an invite to ');

export const isJoin = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' has joined ');

export const isLeave = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' has left ');

export const isRoleChange = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' is now a(n) ');

export const isChannelEdit = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' has been edited ');

export const isGroupMeta = (yarn: Yarn) =>
  isJoin(yarn) || isRoleChange(yarn) || isLeave(yarn) || isChannelEdit(yarn);

export const isDm = (rope: Rope) => rope.thread.startsWith('/dm');

export const isClub = (rope: Rope) => rope.thread.startsWith('/club');

export type NotificationFilterType = 'mentions' | 'replies' | 'invites' | 'all';

export const useNotifications = (
  flag?: Flag,
  showOnly: NotificationFilterType = 'all'
) => {
  const isMobile = useIsMobile();
  const { data: skeins, status: skeinsStatus } = useSkeins(flag);

  if (skeinsStatus !== 'success') {
    return {
      notifications: [],
      mentions: [],
      count: 0,
      loaded: skeinsStatus === 'error',
    };
  }

  const filter = (s: Skein) => {
    switch (showOnly) {
      case 'mentions':
        return isMention(s.top);
      case 'replies':
        return isReply(s.top);
      case 'invites':
        return isInvite(s.top);
      default:
        return true;
    }
  };

  const unreads = skeins.filter((s) => s.unread);
  const filteredSkeins = skeins.filter(filter);
  const notifications = groupSkeinsByDate(filteredSkeins);

  return {
    notifications,
    unreadMentions: unreads.filter((s) => isMention(s.top)),
    unreadReplies: unreads.filter((s) => isReply(s.top)),
    unreadInvites: unreads.filter((s) => isInvite(s.top)),
    count: unreads.length,
    replyCount: unreads.filter((s) => isReply(s.top)).length,
    inviteCount: unreads.filter((s) => isInvite(s.top)).length,
    loaded: skeinsStatus === 'success' || skeinsStatus === 'error',
  };
};
