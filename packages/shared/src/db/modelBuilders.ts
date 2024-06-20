import { unixToDa } from '@urbit/api';

import * as api from '../api';
import {
  getCanonicalPostId,
  isDmChannelId,
  isGroupDmChannelId,
} from '../api/apiUtils';
import * as db from '../db';
import * as logic from '../logic';
import * as ub from '../urbit';
import * as types from './types';

export function assemblePostFromActivityEvent(event: db.ActivityEvent) {
  if (!['post', 'reply'].includes(event.type)) {
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
    content: JSON.stringify(postContent),
    textContent: ub.getTextContent(event.content as ub.Story),
    images: api.getContentImages(event.id, event.content as ub.Story),
    reactions: [],
    replies: [],
    hidden: false,
  };

  return post;
}

export function buildPendingPost({
  authorId,
  channel,
  content,
  parentId,
}: {
  authorId: string;
  channel: types.Channel;
  content: ub.Story;
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
    authorId,
    channelId: channel.id,
    groupId: channel.groupId,
    type,
    sentAt,
    receivedAt: sentAt,
    title: '',
    image: '',
    content: JSON.stringify(postContent),
    textContent: ub.getTextContent(content),
    images: api.getContentImages(id, content),
    reactions: [],
    replies: [],
    replyContactIds: [],
    replyCount: 0,
    hidden: false,
    parentId,
    deliveryStatus,
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
    members: [partnerMember],
  };
}
