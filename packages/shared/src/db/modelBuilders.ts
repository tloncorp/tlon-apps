import { unixToDa } from '@urbit/aura';

import * as api from '../api';
import { getCanonicalPostId } from '../api/apiUtils';
import * as db from '../db';
import * as logic from '../logic';
import { convertToAscii } from '../logic';
import * as ub from '../urbit';
import { getChannelKindFromType } from '../urbit';
import * as types from './types';

export function assembleNewChannelIdAndName({
  title,
  channelType,
  existingChannels,
  currentUserId,
}: {
  title: string;
  channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
  existingChannels: db.Channel[];
  currentUserId: string;
}) {
  const titleIsNumber = Number.isInteger(Number(title));
  // we need unique channel names that are valid for urbit's @tas type
  const tempChannelName = titleIsNumber
    ? `channel-${title}`
    : convertToAscii(title).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');
  const channelKind = getChannelKindFromType(channelType);
  const tempNewChannelFlag = `${channelKind}/${currentUserId}/${tempChannelName}`;
  const existingChannel = () => {
    return existingChannels.find(
      (channel) => channel.id === tempNewChannelFlag
    );
  };

  const randomSmallNumber = Math.floor(Math.random() * 1000);
  const channelName = existingChannel()
    ? `${tempChannelName}-${randomSmallNumber}`
    : tempChannelName;
  const newChannelFlag = `${currentUserId}/${channelName}`;
  const newChannelNest = `${channelKind}/${newChannelFlag}`;
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
    content: JSON.stringify(postContent),
    textContent: logic.getTextContent(
      event.content as ub.Story,
      logic.PlaintextPreviewConfig.inlineConfig
    ),
    images: api.getContentImages(event.id, event.content as ub.Story),
    reactions: [],
    replies: [],
    hidden: false,
    syncedAt: 0,
  };

  return post;
}

/**
 * Builds an update you can pass to `db.updatePost()`.
 */
export function buildPostUpdate({
  id,
  content,
  metadata,
  deliveryStatus = 'pending',
}: {
  id: types.Post['id'];
  content: ub.Story;
  metadata?: db.PostMetadata;
  deliveryStatus?: db.PostDeliveryStatus;
}) {
  const [postContent, postFlags] = api.toPostContent(content);
  return {
    title: metadata?.title ?? '',
    image: metadata?.image ?? '',
    content: JSON.stringify(postContent),
    textContent: logic.getTextContent(
      postContent,
      logic.PlaintextPreviewConfig.inlineConfig
    ),
    images: api.getContentImages(id, content),
    deliveryStatus,
    ...postFlags,
  } satisfies Partial<types.Post>;
}

export function buildPost({
  authorId,
  author,
  channel,
  content,
  metadata,
  parentId,
  deliveryStatus = 'pending',
}: {
  authorId: string;
  author?: types.Contact | null;
  channel: types.Channel;
  content: ub.Story;
  metadata?: db.PostMetadata;
  parentId?: string;
  deliveryStatus?: db.PostDeliveryStatus;
}): types.Post {
  const sentAt = Date.now();
  const id = getCanonicalPostId(unixToDa(sentAt).toString());
  const type = logic.getPostTypeFromChannelId({
    channelId: channel.id,
    parentId,
  });

  const contentUpdate = buildPostUpdate({
    id,
    content,
    metadata,
    deliveryStatus,
  });

  return {
    id,
    author,
    authorId,
    channelId: channel.id,
    groupId: channel.groupId,
    type,
    sentAt,
    receivedAt: sentAt,
    reactions: [],
    replies: [],
    replyContactIds: [],
    replyCount: 0,
    hidden: false,
    parentId,
    syncedAt: Date.now(),
    ...contentUpdate,
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
    contactId: dmPartnerId,
    type: 'dm',
    currentUserIsMember: true,
    postCount: 0,
    unreadCount: 0,
    isPendingChannel: true,
    isDmInvite: false,
    members: [partnerMember],
  };
}

type Optional<Base, OptionalProperties extends keyof Base> = Omit<
  Base,
  OptionalProperties
> &
  Partial<Pick<Base, OptionalProperties>>;

export function buildChannel(
  overrides: Optional<
    db.Channel,
    | 'addedToGroupAt'
    | 'contactId'
    | 'contentConfiguration'
    | 'coverImage'
    | 'coverImageColor'
    | 'currentUserIsMember'
    | 'description'
    | 'firstUnreadPostId'
    | 'groupId'
    | 'iconImage'
    | 'iconImageColor'
    | 'isDmInvite'
    | 'isPendingChannel'
    | 'lastPostAt'
    | 'lastPostId'
    | 'lastViewedAt'
    | 'members'
    | 'postCount'
    | 'order'
    | 'remoteUpdatedAt'
    | 'syncedAt'
    | 'title'
    | 'unreadCount'
  >
): db.Channel {
  return {
    addedToGroupAt: null,
    contactId: null,
    contentConfiguration: null,
    coverImage: null,
    coverImageColor: null,
    currentUserIsMember: null,
    currentUserIsHost: null,
    description: null,
    firstUnreadPostId: null,
    groupId: null,
    iconImage: null,
    iconImageColor: null,
    isDmInvite: false,
    isNewMatchedContact: null,
    isPendingChannel: null,
    lastPostAt: null,
    lastPostId: null,
    lastViewedAt: null,
    members: [],
    postCount: null,
    order: null,
    remoteUpdatedAt: null,
    syncedAt: null,
    title: '',
    unreadCount: null,
    ...overrides,
  };
}

export function buildChatMember(
  overrides: Optional<
    db.ChatMember,
    'chatId' | 'contact' | 'joinedAt' | 'status'
  >
): db.ChatMember {
  return {
    chatId: null,
    contact: null,
    joinedAt: null,
    status: null,
    ...overrides,
  };
}

interface ChatMembersBuilder {
  add(
    ...overrides: Array<
      Optional<Omit<db.ChatMember, 'chatId' | 'membershipType'>, 'contact'>
    >
  ): ChatMembersBuilder;
  build(): db.ChatMember[];
}

/**
 * Build a list of chat members, specifying common fields in one place.
 *
 * ```ts
 * const channel = {
 *   members: buildChatMembers({ chatId: '1', membershipType: 'channel' })
 *     .add({ contactId: '2', status: 'joined' })
 *     .add({ contactId: '3', status: 'invited' })
 *     .build()
 * };
 * ```
 */
export function buildChatMembers(
  commonFields: Pick<db.ChatMember, 'chatId' | 'membershipType'>
): ChatMembersBuilder {
  const members: db.ChatMember[] = [];

  return {
    add(...overridesList) {
      for (const overrides of overridesList) {
        const member = buildChatMember({ ...commonFields, ...overrides });
        members.push(member);
      }
      return this;
    },
    build() {
      return members;
    },
  };
}

export function postFromPostActivityEvent(post: ub.PostEvent['post']): db.Post {
  const id = post.key.id.split('/')[1];
  const receivedAt = getReceivedAtFromId(id);
  const { sent, author } = ub.getIdParts(post.key.id);
  return {
    id,
    authorId: author,
    channelId: post.channel,
    content: post.content,
    type: 'chat',
    receivedAt,
    syncedAt: undefined,
    sentAt: sent,
  };
}

export function postFromDmPostActivityEvent(
  dmPost: ub.DmPostEvent['dm-post']
): db.Post {
  const { sent, author } = ub.getIdParts(dmPost.key.id);
  // key.id looks like `dm/000.000.000.mor.eme.ssa.gei.dxx`
  const id = dmPost.key.id.split('/')[1];
  const receivedAt = getReceivedAtFromId(id);
  return {
    id,
    authorId: author,
    channelId: (dmPost.whom as { ship: string }).ship!,
    content: dmPost.content,
    type: 'chat',
    receivedAt,
    syncedAt: undefined,
    sentAt: sent,
  };
}

function getReceivedAtFromId(postId: string) {
  return api.udToDate(postId.split('/').pop() ?? postId);
}

export function createDmChannelsForNewContacts(
  newContactMatches: [string, string][]
): db.Channel[] {
  const newContacts = newContactMatches.map(([phoneNumber, contactId]) => ({
    id: contactId,
    phoneNumber,
  }));

  return newContacts.map((contact) => ({
    id: contact.id,
    contactId: contact.id,
    type: 'dm' as const,
    currentUserIsMember: null,
    currentUserIsHost: null,
    isDmInvite: false,
    isPending: false,
    isNewMatchedContact: true,
    title: '',
    isNew: true,
    members: [
      {
        chatId: contact.id,
        contactId: contact.id,
        contact: contact,
        membershipType: 'channel' as const,
      },
    ],
    timestamp: Date.now(),
  }));
}
