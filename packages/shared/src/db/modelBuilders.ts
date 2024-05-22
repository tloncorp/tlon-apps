import { unixToDa } from '@urbit/api';

import * as api from '../api';
import {
  getCanonicalPostId,
  isDmChannelId,
  isGroupDmChannelId,
} from '../api/apiUtils';
import * as ub from '../urbit';
import * as types from './types';

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
    type: parentId ? 'reply' : (channel.id.split('/')[0] as types.PostType),
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
  dmPartnerId: string,
  currentUserId: string
): types.Channel {
  const id = ub.createMultiDmId();
  const partnerMember: types.ChatMember = {
    chatId: id,
    contactId: dmPartnerId,
    membershipType: 'channel',
    status: 'invited',
  };

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
    members: [partnerMember, currentUserMember],
  };
}
