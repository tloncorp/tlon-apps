import { unixToDa } from '@urbit/aura';

import * as api from '../api';
import {
  getCanonicalPostId,
  isDmChannelId,
  isGroupDmChannelId,
} from '../api/apiUtils';
import * as db from '../db';
import * as logic from '../logic';
import { convertToAscii } from '../logic';
import { CurrentChats, PendingChats } from '../store';
import * as ub from '../urbit';
import { getChannelKindFromType } from '../urbit';
import * as types from './types';

export function assembleNewChannelIdAndName({
  title,
  channelType,
  currentChatData,
  pendingChats,
  currentUserId,
}: {
  title: string;
  channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
  currentChatData?: CurrentChats | null;
  pendingChats?: PendingChats | null;
  currentUserId: string;
}) {
  const existingChannels = [
    ...(pendingChats ?? []),
    ...(currentChatData?.pinned ?? []),
    ...(currentChatData?.unpinned ?? []),
  ];

  const titleIsNumber = Number.isInteger(Number(title));
  // we need unique channel names that are valid for urbit's @tas type
  const tempChannelName = titleIsNumber
    ? `channel-${title}`
    : convertToAscii(title).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');
  // @ts-expect-error this is fine
  const channelKind = getChannelKindFromType(channelType);
  const tempNewChannelFlag = `${channelKind}/${currentUserId}/${tempChannelName}`;
  const existingChannel = () => {
    return existingChannels.find(
      (channel) => channel.id === tempNewChannelFlag
    );
  };

  const randomSmallNumber = Math.floor(Math.random() * 100);
  const channelName = existingChannel()
    ? `${tempChannelName}-${randomSmallNumber}`
    : tempChannelName;
  const newChannelFlag = `${currentUserId}/${channelName}`;
  const newChannelNest = `${channelType}/${newChannelFlag}`;

  return {
    name: channelName,
    id: newChannelNest,
  };
}

export function assembleParentPostFromActivityEvent(event: db.ActivityEvent) {
  if (!['post', 'reply', 'flag-post', 'flag-reply'].includes(event.type)) {
    console.warn(
      `assembling parent post from activity event that isn't a message`,
      event.id,
      event
    );
  }

  if (!event.parentAuthorId || !event.channelId) {
    console.warn(
      `assembling parent post from activity event with missing data`,
      event.id,
      event
    );
  }
  const post: types.Post = {
    id: event.parentId ?? '',
    type: logic.getPostTypeFromChannelId({
      channelId: event.channelId,
      parentId: event.parentId,
    }),
    authorId: event.parentAuthorId ?? '',
    channelId: event.channelId ?? '',
    groupId: event.groupId,
    sentAt: event.timestamp,
    receivedAt: event.timestamp,
    reactions: [],
    replies: [],
    hidden: false,
    syncedAt: 0,
  };

  return post;
}

export function assemblePostFromActivityEvent(event: db.ActivityEvent) {
  if (!['post', 'reply', 'flag-post', 'flag-reply'].includes(event.type)) {
    console.warn(
      `assembling post from activity event that isn't a message`,
      event.id,
      event
    );
  }

  if (!event.authorId || !event.channelId) {
    console.warn(
      `assembling post from activity event with missing data`,
      event.id,
      event
    );
  }

  const [postContent, _flags] = api.toPostContent(event.content as ub.Story);
  const post: types.Post = {
    id: event.postId ?? event.id,
    type: logic.getPostTypeFromChannelId({
      channelId: event.channelId,
      parentId: event.parentId,
    }),
    authorId: event.authorId ?? '',
    parentId: event.parentId ?? '',
    channelId: event.channelId ?? '',
    groupId: event.groupId,
    sentAt: event.timestamp,
    receivedAt: event.timestamp,
    content: postContent,
    textContent: ub.getTextContent(event.content as ub.Story),
    images: api.getContentImages(event.id, event.content as ub.Story),
    reactions: [],
    replies: [],
    hidden: false,
    syncedAt: 0,
  };

  return post;
}

export function buildPendingPost({
  authorId,
  author,
  channel,
  content,
  metadata,
  parentId,
}: {
  authorId: string;
  author?: types.Contact | null;
  channel: types.Channel;
  content: ub.Story;
  metadata?: db.PostMetadata;
  parentId?: string;
}): types.Post {
  const sentAt = Date.now();
  const id = getCanonicalPostId(unixToDa(sentAt).toString());
  const [postContent, postFlags] = api.toPostContent(content);
  const type = logic.getPostTypeFromChannelId({
    channelId: channel.id,
    parentId,
  });

  // TODO: punt on DM delivery status until we have a single subscription
  // to lean on
  const deliveryStatus =
    isDmChannelId(channel.id) || isGroupDmChannelId(channel.id)
      ? null
      : 'pending';

  return {
    id,
    author,
    authorId,
    channelId: channel.id,
    groupId: channel.groupId,
    type,
    sentAt,
    receivedAt: sentAt,
    title: metadata?.title ?? '',
    image: metadata?.image ?? '',
    content: postContent,
    textContent: ub.getTextContent(content),
    images: api.getContentImages(id, content),
    reactions: [],
    replies: [],
    replyContactIds: [],
    replyCount: 0,
    hidden: false,
    parentId,
    deliveryStatus,
    syncedAt: Date.now(),
    ...postFlags,
  };
}

export function buildPendingMultiDmChannel(
  participants: string[],
  currentUserId: string
): types.Channel {
  const id = ub.createMultiDmId();
  const pendingMembers: types.ChatMember[] = participants.map(
    (participant) => ({
      chatId: id,
      contactId: participant,
      membershipType: 'channel',
      status: 'invited',
    })
  );

  const currentUserMember: types.ChatMember = {
    chatId: id,
    contactId: currentUserId,
    membershipType: 'channel',
    status: 'joined',
  };

  return {
    id,
    type: 'groupDm',
    currentUserIsMember: true,
    postCount: 0,
    unreadCount: 0,
    isPendingChannel: true,
    members: [...pendingMembers, currentUserMember],
  };
}

export function buildPendingSingleDmChannel(
  dmPartnerId: string
): types.Channel {
  const id = dmPartnerId;
  const partnerMember: types.ChatMember = {
    chatId: id,
    contactId: dmPartnerId,
    membershipType: 'channel',
    status: 'invited',
  };

  return {
    id,
    type: 'dm',
    currentUserIsMember: true,
    postCount: 0,
    unreadCount: 0,
    isPendingChannel: true,
    members: [partnerMember],
  };
}
